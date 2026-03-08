import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Ты — эксперт-аналитик интерьерных брифов. Тебе дают бриф дизайн-проекта.

Твоя задача:
1. Найти **противоречия** (contradictions) — где пожелания клиента конфликтуют друг с другом.
2. Сформулировать **уточняющие вопросы** (questions) — что нужно узнать, чтобы двигаться дальше.

Ответь СТРОГО вызовом функции analyze_brief_result. Не пиши текст вне функции.

Правила:
- Противоречий обычно 0-5. Не выдумывай, если всё логично.
- Вопросов обычно 3-10. Приоритет: critical (блокирует проектирование), important (сильно влияет), optional (было бы полезно).
- Пиши на русском языке.
- Для каждого вопроса укажи "unlocks" — что именно разблокирует ответ.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { briefText, projectContext } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = `## Контекст проекта
${projectContext || "Не указан"}

## Бриф
${briefText}`;

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
              name: "analyze_brief_result",
              description: "Return structured analysis of the brief",
              parameters: {
                type: "object",
                properties: {
                  issues: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["contradiction"] },
                        title: { type: "string" },
                        evidence: { type: "string" },
                        impact: { type: "string" },
                        suggestion: { type: "string" },
                      },
                      required: ["type", "title"],
                      additionalProperties: false,
                    },
                  },
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        priority: { type: "string", enum: ["critical", "important", "optional"] },
                        text: { type: "string" },
                        unlocks: { type: "string" },
                      },
                      required: ["priority", "text"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["issues", "questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_brief_result" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${response.status}` }),
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
    console.error("analyze-brief error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
