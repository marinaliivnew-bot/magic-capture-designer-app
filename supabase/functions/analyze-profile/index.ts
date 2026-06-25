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
    const { systemPrompt, userPrompt: rawUserPrompt, imageUrls, pdfUrls, pdfFiles } = await req.json();
    const MAX_USER_PROMPT_CHARS = 60_000;
    const userPrompt = rawUserPrompt?.length > MAX_USER_PROMPT_CHARS
      ? rawUserPrompt.slice(0, MAX_USER_PROMPT_CHARS) + "\n\n[...текст обрезан для соблюдения лимита контекста]"
      : rawUserPrompt;

    const OPENAI_API_KEY = Deno.env.get("VITE_OPENAI_KEY") || Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const attachedPdfUrls = Array.isArray(pdfUrls)
      ? pdfUrls.filter((url) => typeof url === "string" && url.toLowerCase().includes(".pdf")).slice(0, 2)
      : [];
    const attachedPdfFiles = Array.isArray(pdfFiles)
      ? pdfFiles
          .filter((file) => file && typeof file.path === "string" && typeof file.name === "string")
          .slice(0, 2)
      : [];

    const uploadOpenAiFile = async (fileName: string, fileData: Blob) => {
      const form = new FormData();
      form.append("purpose", "user_data");
      form.append("file", fileData, fileName);

      const uploadResponse = await fetch("https://api.openai.com/v1/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: form,
      });

      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text();
        throw new Error(`OpenAI file upload ${uploadResponse.status}: ${errText.slice(0, 500)}`);
      }

      const uploadData = await uploadResponse.json();
      return uploadData.id as string;
    };

    const deleteOpenAiFiles = async (fileIds: string[]) => {
      await Promise.allSettled(fileIds.map((fileId) => (
        fetch(`https://api.openai.com/v1/files/${fileId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        })
      )));
    };

    if (attachedPdfUrls.length > 0 || attachedPdfFiles.length > 0) {
      type ResponseContentPart =
        | { type: "input_text"; text: string }
        | { type: "input_file"; file_url: string }
        | { type: "input_file"; file_id: string };

      const content: ResponseContentPart[] = [{ type: "input_text", text: userPrompt }];
      const uploadedFileIds: string[] = [];

      if (attachedPdfFiles.length > 0) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !supabaseKey) {
          return new Response(
            JSON.stringify({ error: "Supabase storage credentials are not configured" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        for (const file of attachedPdfFiles) {
          const { data: pdfData, error: pdfError } = await supabase.storage
            .from("designer-portfolio")
            .download(file.path);

          if (pdfError || !pdfData) {
            console.warn("PDF download for OpenAI failed:", file.path, pdfError);
            continue;
          }

          const fileId = await uploadOpenAiFile(file.name, pdfData);
          uploadedFileIds.push(fileId);
          content.push({ type: "input_file", file_id: fileId });
        }
      }

      if (content.length === 1) {
        content.push(...attachedPdfUrls.map((url) => ({ type: "input_file" as const, file_url: encodeURI(url) })));
      }

      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          instructions: systemPrompt,
          input: [{ role: "user", content }],
          max_output_tokens: 2500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("OpenAI Responses error:", response.status, errText);
        await deleteOpenAiFiles(uploadedFileIds);
        return new Response(
          JSON.stringify({ error: `OpenAI ${response.status}`, details: errText }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      await deleteOpenAiFiles(uploadedFileIds);
      const text = data.output_text
        || data.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
          .map((part: { text?: string }) => part.text || "")
          .join("")
        || "";

      return new Response(JSON.stringify({ text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build user message content — text + optional portfolio images for vision
    type ContentPart =
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail: "low" } };

    const userContent: ContentPart[] = [{ type: "text", text: userPrompt }];
    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      for (const url of imageUrls.slice(0, 6)) {
        userContent.push({ type: "image_url", image_url: { url, detail: "low" } });
      }
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent.length === 1 ? userContent[0].text : userContent },
        ],
        max_tokens: 2500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error:", response.status, errText);
      // Return 200 so Supabase JS client doesn't swallow the body
      return new Response(
        JSON.stringify({ error: `OpenAI ${response.status}`, details: errText }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-profile error:", e);
    // Return 200 so the body is readable by the client
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
