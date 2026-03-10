import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Ты — креативный директор интерьерного бюро. По брифу и контексту проекта ты создаёшь концепт-борд — набор блоков, каждый из которых описывает визуальное направление.

Типы блоков (создай ровно 5, по одному каждого типа):
1. atmosphere — Атмосфера / Вайб: общее настроение, эмоция пространства
2. palette — Цветовая палитра: основные и акцентные цвета, их сочетания
3. materials — Материалы и текстуры: дерево, камень, ткани, металл и т.д.
4. furniture — Мебель / формы: стиль мебели, силуэты, формы
5. lighting — Освещение: тип, настроение, сценарии света

ВАЖНО: В caption ОБЯЗАТЕЛЬНО упоминай конкретные помещения проекта с их габаритами, если они указаны в контексте.
Например: «Для гостиной 6×4,5м — тёплое многослойное освещение...», «В спальне 4×3м — мягкие натуральные текстуры...».
Привязывай рекомендации к реальным помещениям, учитывай их размеры при формировании рекомендаций.

Для каждого блока:
- caption: развёрнутое описание (2-4 предложения) визуального направления с привязкой к конкретным помещениям
- search_queries: ровно 3 поисковых запроса на английском для поиска референсных изображений (для Pinterest/Unsplash)

Пиши caption на русском языке. search_queries — на английском.
Ответь СТРОГО вызовом функции generate_board_result.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { briefText, projectContext, userRefs } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Слишком много запросов, попробуйте позже" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Необходимо пополнить баланс AI" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
