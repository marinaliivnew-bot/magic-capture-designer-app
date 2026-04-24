import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-session-id",
};

const SYSTEM_PROMPT = `Ты — опытный дизайнер интерьера. Принимай конкретные дизайнерские решения
на основе брифа. Не пересказывай бриф — интерпретируй его.

ВАЖНО: Если в запросе есть раздел "СТАНДАРТЫ ДИЗАЙНЕРА" — они имеют наивысший приоритет.
Борд должен отражать авторский стиль дизайнера, адаптированный к пожеланиям клиента.
Стандарты дизайнера перекрывают общие предпочтения клиента там, где они пересекаются.

ВАЖНО: В брифе есть поле "табу" (style_dislikes). Ни один search_query
не должен противоречить табу. Например, если табу "без золота" —
не используй gold, brass, golden в запросах.

Создай ровно 5 блоков. Для каждого — своя логика:

ATMOSPHERE (атмосфера):
- caption: 1-2 предложения — эмоция и сценарий, не описание стиля
- search_queries: 3 запроса для Unsplash. Формат: конкретный объект + 
  материал + свет. Обязательно добавляй "interior" или "room". 
  Пример: "log cabin interior warm light evening", 
  "scandinavian sauna wooden bench steam"
- color_chips: пустой массив []
- lighting_zones: пустой массив []

PALETTE (палитра):
- caption: 1 предложение — как цвета распределяются по помещениям
- search_queries: 1 запрос для референсного интерьерного фото
- color_chips: массив из 5-6 объектов: 
  { "hex": "#F5ECD7", "name": "сливочный", "role": "стены" }
  Роли: стены / пол / акцент / текстиль / детали
- lighting_zones: пустой массив []

MATERIALS (материалы):
- caption: конкретные материалы с указанием помещения и причины выбора. 
  Упоминай ценовой сегмент (эконом/средний/премиум). 2-3 предложения.
- search_queries: 3 запроса. Формат: материал + применение + фактура. 
  Добавляй "texture", "surface", "tile", "floor" — не "interior style".
  Пример: "quartz vinyl plank floor wood texture", 
  "matte stone tile bathroom warm beige"
- color_chips: пустой массив []
- lighting_zones: пустой массив []

FURNITURE (мебель):
- caption: типология мебели с габаритами, привязанная к размерам помещений 
  из брифа. Если гостиная 12м² — пиши "компактный двухместный диван 
  до 160см", не "диван средней величины". 2-3 предложения.
- search_queries: 3 запроса. Формат: тип мебели + материал + стиль. 
  Пример: "compact two seat sofa linen fabric natural wood legs",
  "wooden bed frame light oak minimal"
- color_chips: пустой массив []
- lighting_zones: пустой массив []

LIGHTING (освещение):
- caption: 1 предложение общее
- search_queries: 2 запроса для визуальных референсов освещения
- color_chips: пустой массив []
- lighting_zones: массив из 3-5 объектов по зонам помещений:
  { "zone": "гостиная", "scenario": "вечерний отдых", 
    "type": "подвесной светильник + торшер", "kelvin": "2700K" }

Примеры ПЛОХИХ caption:
"Тёплая нейтральная палитра соответствует скандинавскому стилю"
"В парной используется дерево согласно пожеланиям"

Примеры ХОРОШИХ caption:
"Для парной 5,79м² — вертикальная термоосина: светлее ели, 
не темнеет и не выделяет смолу при нагреве"
"Диван ставим под углом 45° к входу — визуально зонирует кухню 
и гостиную в 12м² без перегородки"

Отвечай ТОЛЬКО вызовом функции generate_board_result.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { briefText, projectContext, userRefs, designerProfileText } = await req.json();

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

    const designerBlock = designerProfileText
      ? `## СТАНДАРТЫ ДИЗАЙНЕРА (наивысший приоритет)\n${designerProfileText}\n\n`
      : "";

    const userPrompt = `${designerBlock}## Контекст проекта
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
                        color_chips: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              hex: { type: "string" },
                              name: { type: "string" },
                              role: { type: "string" },
                            },
                            required: ["hex", "name", "role"],
                            additionalProperties: false,
                          },
                        },
                        lighting_zones: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              zone: { type: "string" },
                              scenario: { type: "string" },
                              type: { type: "string" },
                              kelvin: { type: "string" },
                            },
                            required: ["zone", "scenario", "type", "kelvin"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["block_type", "caption", "search_queries", "color_chips", "lighting_zones"],
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
