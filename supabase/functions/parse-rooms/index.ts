import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { text } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Ты помощник дизайнера интерьера. Из текста извлеки список помещений.
Для каждого помещения верни JSON-объект с полями:
- name: string — название помещения (например: "Спальня", "Кухня", "Санузел")
- room_type: string — одно из значений: kitchen, living_room, bedroom, bathroom, office, hallway, other
- dimensions_text: string — габариты если упомянуты (например "4.2×3.1, h=2.7"), иначе пустая строка

Ответь ТОЛЬКО валидным JSON-массивом без markdown, преамбулы и постамбулы.
Пример: [{"name":"Спальня","room_type":"bedroom","dimensions_text":"4×3"},{"name":"Санузел","room_type":"bathroom","dimensions_text":""}]`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        max_tokens: 1000,
        temperature: 0,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    let rooms;
    try {
      rooms = JSON.parse(content);
    } catch {
      rooms = [];
    }
    return new Response(JSON.stringify({ rooms }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
