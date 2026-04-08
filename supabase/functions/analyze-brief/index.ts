import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-session-id",
};

const SYSTEM_PROMPT = `Ты — эксперт-аналитик интерьерных брифов. Работаешь как опытный 
дизайнер на первой встрече с клиентом.

ВАЖНО: ВСЕ ответы, вопросы и описания — строго на русском языке.

Алгоритм работы — строго по шагам:

ШАГ 1. Прочитай раздел "УЖЕ ИЗВЕСТНО" в сообщении пользователя.
Это список того, что клиент уже сообщил. По этим пунктам 
вопросы НЕ задаются — никогда, ни в какой форме.

ШАГ 2. Найди противоречия — только там, где пожелания реально 
конфликтуют друг с другом. Не выдумывай. Обычно 0-3.

ШАГ 3. Сформулируй вопросы ТОЛЬКО по реально пустым местам —
то, чего нет ни в брифе, ни в разделе "УЖЕ ИЗВЕСТНО".

Приоритеты вопросов:
- critical: без ответа нельзя начать планировку
- important: влияет на концепцию
- optional: уточнение, незначительно улучшающее результат

Правила формулировки вопросов:
- Пиши как человек, не как анкета
- Один вопрос = одна конкретная вещь
- Не задавай вопросы про оттенки, если палитра уже названа
- Не задавай вопросы про сценарии, если они описаны
- Не задавай вопросы про состав семьи, если он указан
- Максимум 5 вопросов. Лучше 3 точных, чем 7 размытых.

Ответь СТРОГО вызовом функции analyze_brief_result.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { briefText, projectContext, userRefs } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const refsBlock = Array.isArray(userRefs) && userRefs.length > 0
      ? `\n\n## Пользовательские референсы\nПользователь загрузил свои референсы. Учитывай это при формировании style_likes.\n${userRefs.map((r: { url: string; step?: string }) => `- [${r.step || "ref"}] ${r.url}`).join("\n")}`
      : "";

    const knownFacts = [
      briefText.includes('users') ? `Пользователи: уже описаны в брифе` : null,
      projectContext ? `Контекст: ${projectContext}` : null,
    ].filter(Boolean).join('\n');

    const userPrompt = `## УЖЕ ИЗВЕСТНО — по этим пунктам вопросы не нужны:
${knownFacts || 'Нет данных'}

Полный бриф (для поиска пустых мест и противоречий):
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
