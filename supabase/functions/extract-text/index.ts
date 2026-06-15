import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// pdf.js extracts real text layers from PDFs. The regex scanner below stays as a fallback
// for edge cases where pdf.js cannot parse a file in the Edge Runtime.
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.mjs";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-session-id",
};

const decodeXmlEntities = (text: string) => {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
};

const extractDocxText = async (fileData: Blob) => {
  const arrayBuffer = await fileData.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const xmlPaths = Object.keys(zip.files).filter((path) => (
    /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(path)
  ));

  const chunks: string[] = [];
  for (const path of xmlPaths) {
    const file = zip.file(path);
    if (!file) continue;

    const xml = await file.async("text");
    const text = decodeXmlEntities(
      xml
        .replace(/<w:tab\/>/g, "\t")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+\n/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
    );

    if (text.length > 0) {
      chunks.push(text);
    }
  }

  return chunks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePath } = await req.json();

    if (!filePath) {
      return new Response(
        JSON.stringify({ error: "filePath is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("designer-portfolio")
      .download(filePath);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      return new Response(
        JSON.stringify({ error: "Failed to download file", text: "", fileName: filePath }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileName = filePath.split("/").pop() || filePath;
    const lowerName = fileName.toLowerCase();

    let text = "";
    let truncated = false;
    let note = "текст извлечён";
    let pageCount: number | null = null;
    const fileSizeBytes = fileData.size;
    const MAX_CHARS = 30_000;

    // Plain-text knowledge files — read directly
    if (lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
      text = await fileData.text();
    }
    // PDF files — first try pdf.js, then fall back to a raw PDF string scan
    else if (lowerName.endsWith(".pdf")) {
      try {
        const arrayBuffer = await fileData.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        const pdfTextChunks: string[] = [];

        try {
          const pdf = await pdfjsLib.getDocument({
            data: uint8.slice(),
            disableFontFace: true,
            isEvalSupported: false,
            useSystemFonts: false,
          }).promise;
          pageCount = pdf.numPages;

          const pageLimit = Math.min(pdf.numPages, 30);
          for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            const pageText = content.items
              .map((item: unknown) => {
                if (item && typeof item === "object" && "str" in item) {
                  return String((item as { str?: string }).str || "");
                }
                return "";
              })
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();

            if (pageText.length > 0) {
              pdfTextChunks.push(pageText);
            }
          }

          text = pdfTextChunks.join("\n\n").replace(/\s+/g, " ").trim();
          if (text.length >= 50) {
            note = pdf.numPages > pageLimit
              ? `текст извлечён pdf.js, обработано ${pageLimit}/${pdf.numPages} страниц`
              : `текст извлечён pdf.js, страниц: ${pdf.numPages}`;
          }
        } catch (pdfJsError) {
          console.warn("pdf.js parse failed, falling back to raw scan:", pdfJsError);
        }

        if (text.length < 50) {
          // Extract raw text from PDF bytes — simple string scan
          // Finds text between BT/ET markers (PDF text objects)
          const decoder = new TextDecoder("latin1");
          const raw = decoder.decode(uint8);
          const rawPageCount = (raw.match(/\/Type\s*\/Page\b/g) || []).length;
          pageCount = pageCount ?? (rawPageCount || null);

          const textChunks: string[] = [];

          // Method 1: extract strings in parentheses after Tj/TJ operators
          const tjRegex = /\(([^)]{1,500})\)\s*Tj/g;
          let match;
          while ((match = tjRegex.exec(raw)) !== null) {
            const chunk = match[1]
              .replace(/\\n/g, " ")
              .replace(/\\r/g, " ")
              .replace(/\\\(/g, "(")
              .replace(/\\\)/g, ")")
              .replace(/\\\\/g, "\\")
              .trim();
            if (chunk.length > 2) {
              textChunks.push(chunk);
            }
          }

          // Method 2: extract array strings for TJ operator
          const tjArrayRegex = /\[([^\]]{1,1000})\]\s*TJ/g;
          while ((match = tjArrayRegex.exec(raw)) !== null) {
            const inner = match[1];
            const strRegex = /\(([^)]{1,200})\)/g;
            let strMatch;
            while ((strMatch = strRegex.exec(inner)) !== null) {
              const chunk = strMatch[1].trim();
              if (chunk.length > 2) {
                textChunks.push(chunk);
              }
            }
          }

          text = textChunks.join(" ").replace(/\s+/g, " ").trim();
          if (text.length >= 50) {
            note = "текст извлечён fallback-сканером";
          }
        }

        // If extraction yielded nothing meaningful — note it
        if (text.length < 50) {
          text = "[PDF содержит преимущественно изображения или нестандартное кодирование — текст недоступен для автоматического извлечения]";
          note = "PDF без доступного текстового слоя";
        }
      } catch (pdfError) {
        console.error("PDF parse error:", pdfError);
        text = "[Ошибка извлечения текста из PDF]";
        note = "ошибка извлечения PDF";
      }
    }
    // DOCX files — Office Open XML is a zip archive with document XML inside
    else if (lowerName.endsWith(".docx")) {
      try {
        text = await extractDocxText(fileData);
        if (text.length >= 50) {
          note = "текст извлечён из DOCX";
        } else {
          text = "[DOCX не содержит доступного текста или состоит преимущественно из изображений]";
          note = "DOCX без доступного текста";
        }
      } catch (docxError) {
        console.error("DOCX parse error:", docxError);
        text = "[Ошибка извлечения текста из DOCX]";
        note = "ошибка извлечения DOCX";
      }
    }
    // Legacy DOC is a binary format; ask users to save it as DOCX/PDF.
    else if (lowerName.endsWith(".doc")) {
      text = "[DOC — старый бинарный формат. Сохраните файл как DOCX или PDF.]";
      note = "DOC не поддерживается";
    }
    else {
      text = "[Неизвестный формат файла]";
      note = "неизвестный формат файла";
    }

    const originalCharCount = text.length;

    // Truncate if too long
    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS);
      truncated = true;
    }

    return new Response(
      JSON.stringify({
        text,
        fileName,
        truncated,
        originalCharCount,
        includedCharCount: text.length,
        note,
        pageCount,
        fileSizeBytes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("extract-text error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", text: "", truncated: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
