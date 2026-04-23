import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-session-id",
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
    const MAX_CHARS = 3000;

    // TXT files — read directly
    if (lowerName.endsWith(".txt")) {
      text = await fileData.text();
    }
    // PDF files — extract text from raw content
    else if (lowerName.endsWith(".pdf")) {
      try {
        const arrayBuffer = await fileData.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);

        // Extract raw text from PDF bytes — simple string scan
        // Finds text between BT/ET markers (PDF text objects)
        const decoder = new TextDecoder("latin1");
        const raw = decoder.decode(uint8);

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

        // If extraction yielded nothing meaningful — note it
        if (text.length < 50) {
          text = "[PDF содержит преимущественно изображения или нестандартное кодирование — текст недоступен для автоматического извлечения]";
        }
      } catch (pdfError) {
        console.error("PDF parse error:", pdfError);
        text = "[Ошибка извлечения текста из PDF]";
      }
    }
    // DOC/DOCX — not parseable without native libs
    else if (lowerName.endsWith(".doc") || lowerName.endsWith(".docx")) {
      text = "[DOC/DOCX формат — текст недоступен для автоматического извлечения. Учти имя файла при анализе.]";
    }
    else {
      text = "[Неизвестный формат файла]";
    }

    // Truncate if too long
    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS);
      truncated = true;
    }

    return new Response(
      JSON.stringify({ text, fileName, truncated }),
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
