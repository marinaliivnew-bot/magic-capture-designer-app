import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Ты — опытный дизайнер интерьера. Твоя задача — принять конкретные дизайнерские решения на основе брифа, а не пересказывать его.

Для каждого блока концепт-борда:
- Предложи конкретное решение (материал, модель, приём, сочетание)
- Объясни ПОЧЕМУ это решение подходит именно для этого пространства с учётом габаритов, сценариев и ограничений
- Добавь 1 профессиональный совет которого клиент сам не догадается

Примеры ПЛОХИХ caption:
'В парной используется дерево согласно пожеланиям клиента'
'Тёплая нейтральная палитра соответствует стилю скандинавский'

Примеры ХОРОШИХ caption:
'Для парной 5,79м² — вертикальная раскладка термоосины: она светлее 
ели, не темнеет и не выделяет смолу при нагреве. Потолок занижаем 
до 2,1м — так парная прогревается быстрее и экономит дрова'
'В гостиной 12,26м² диван ставим не вдоль стены а под углом 45° к 
входу — это визуально зонирует кухню и гостиную без перегородки'

search_queries должны быть конкретными деталями, не общими стилями:
ПЛОХО: 'scandinavian interior warm'
ХОРОШО: 'thermowood aspen sauna vertical paneling'

Отвечай ТОЛЬКО вызовом функции generate_board_result.
Внутри arguments возвращай только валидный JSON без markdown.

Формат результата (совместимо с generate_board_result):
Создай ровно 5 блоков (по одному каждого типа): atmosphere, palette, materials, furniture, lighting.
caption: развёрнутое описание на русском (2-4 предложения) с конкретикой по помещениям (если есть размеры — упоминай их).
search_queries: ровно 3 поисковых запроса на английском.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { briefText, projectContext, userRefs } = await req.json();

    // Supabase Edge Functions не знают `import.meta.env`, поэтому берем ключ из env.
    // Ожидаем имя переменной как в Vite-конфигах: VITE_OPENAI_KEY (с fallback).
    const OPENAI_API_KEY = Deno.env.get("VITE_OPENAI_KEY") || Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY (VITE_OPENAI_KEY) is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const refsBlock = Array.isArray(userRefs) && userRefs.length > 0
      ? `\n\n## Пользовательские референсы\nПользователь загрузил свои референсы. Учитывай их стилистику при генерации концепт-борда.\n${userRefs.map((r: { url: string; step?: string }) => `- [${r.step || "ref"}] ${r.url}`).join("\n")}`
      : "";

    const userPrompt = `## Контекст проекта
${projectContext || "Не указан"}

## Бриф
${briefText}${refsBlock}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_board_result",
              description: "Return structured concept board blocks",
              parameters: {
                type: "object",
                properties: {
                  blocks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        block_type: {
                          type: "string",
                          enum: ["atmosphere", "palette", "materials", "furniture", "lighting"],
                        },
                        caption: { type: "string" },
                        search_queries: {
                          type: "array",
                          items: { type: "string" },
                        },
                      },
                      required: ["block_type", "caption", "search_queries"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["blocks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_board_result" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error:", response.status, errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Слишком много запросов, попробуйте позже" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: `AI error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "AI did not return structured output" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-board error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
