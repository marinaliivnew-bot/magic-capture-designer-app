import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-session-id",
};

const SYSTEM_PROMPT = `Ты — аналитик вкуса клиента для интерьерного дизайнера.

Твоя задача: по исходным данным (брифу и аннотированным референсам) извлечь
реальный вкусовой профиль клиента — не то, что он говорит, а что на самом деле
ищет в интерьере.

ВАЖНО: ВСЕ ответы строго на русском языке.

Алгоритм:

ШАГ 1. Прочитай все аннотированные референсы. Каждая аннотация — это сигнал.
- "likes" = что клиент хочет взять из этого референса
- "dislikes" = что отталкивает, несмотря на то что картинка понравилась
- "tags" = явные ключевые слова

ШАГ 2. Извлеки доминирующие сигналы:
- Повторяющиеся темы = сильный сигнал
- Противоречия между референсами = неопределённость, которую нужно назвать
- Скрытые желания = что за текстом слов

ШАГ 3. Опиши: что клиент отвергает? Даже если он прямо не говорит "нет" —
это видно по тому, чего нет ни в одном референсе.

ШАГ 4. Найди внутренние противоречия в запросе клиента:
- Хочет "уют" и "минимализм" одновременно — как это совместить?
- Любит тепло, но все референсы холодные тона
- Называет скандинавский стиль, но референсы — japandi или mid-century

ШАГ 5. Сформулируй резюме: "Что клиент на самом деле хочет" — одним абзацем.

Ответь СТРОГО вызовом функции analyze_client_taste_result.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { briefText, userRefsStructured, designerProfileText } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("VITE_OPENAI_KEY") || Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const refsBlock = Array.isArray(userRefsStructured) && userRefsStructured.length > 0
      ? userRefsStructured
          .map((ref: any, i: number) => {
            const parts = [`Референс ${i + 1}: ${ref.url}`];
            if (ref.likes) parts.push(`  Нравится: ${ref.likes}`);
            if (ref.dislikes) parts.push(`  Не брать: ${ref.dislikes}`);
            if (ref.tags?.length) parts.push(`  Теги: ${ref.tags.join(", ")}`);
            return parts.join("\n");
          })
          .join("\n\n")
      : "Референсы не предоставлены";

    const profileBlock = designerProfileText
      ? `\n\n=== СТАНДАРТЫ ДИЗАЙНЕРА (только для контекста) ===\n${designerProfileText}`
      : "";

    const userMessage = [
      "=== БРИФ КЛИЕНТА ===",
      briefText || "(бриф не заполнен)",
      "",
      "=== РЕФЕРЕНСЫ И АННОТАЦИИ ===",
      refsBlock,
      profileBlock,
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_client_taste_result",
              description: "Результат анализа вкуса клиента",
              parameters: {
                type: "object",
                properties: {
                  dominant_signals: {
                    type: "array",
                    description: "Повторяющиеся темы и сильные вкусовые сигналы",
                    items: {
                      type: "object",
                      properties: {
                        signal: { type: "string" },
                        strength: { type: "string", enum: ["strong", "moderate", "weak"] },
                        source: { type: "string", description: "Откуда взят сигнал: refs / brief / both" },
                      },
                      required: ["signal", "strength", "source"],
                    },
                  },
                  rejected_elements: {
                    type: "array",
                    description: "Что клиент явно или неявно отвергает",
                    items: { type: "string" },
                  },
                  contradictions: {
                    type: "array",
                    description: "Внутренние противоречия в запросе клиента",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string" },
                        element_a: { type: "string" },
                        element_b: { type: "string" },
                      },
                      required: ["description", "element_a", "element_b"],
                    },
                  },
                  summary: {
                    type: "string",
                    description: "Итоговое резюме: что клиент на самом деле хочет, одним-двумя абзацами",
                  },
                },
                required: ["dominant_signals", "rejected_elements", "contradictions", "summary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_client_taste_result" } },
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(
        JSON.stringify({ error: `OpenAI error: ${response.status}`, detail: err }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(
        JSON.stringify({ error: "No tool call in response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-client-taste error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
