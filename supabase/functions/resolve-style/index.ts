import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-session-id",
};

const SYSTEM_PROMPT = `Ты — аналитик стилевого согласования для интерьерного дизайнера.

Твоя задача: сравнить вкус клиента со стандартами дизайнера и выдать точный список того,
что согласовано, и того, где есть конфликт. Не усредняй — раздели.

ВАЖНО: ВСЕ ответы строго на русском языке.

Три уровня приоритета (строго соблюдать):
1. ОГРАНИЧЕНИЯ (constraints) — абсолютный приоритет, нельзя нарушить ни при каких условиях
2. СТАНДАРТЫ ДИЗАЙНЕРА — высокий приоритет, можно пересмотреть только с явным обоснованием
3. ПРЕДПОЧТЕНИЯ КЛИЕНТА — принимаются в пределах, не нарушающих уровни 1 и 2

Алгоритм:

ШАГ 1. Прочитай профиль дизайнера: стиль, ограничения, визуальный язык.
Это "разрешённое пространство" — то, в рамках чего клиент может выбирать.

ШАГ 2. Прочитай вкус клиента (dominant_signals, rejected_elements).
Для каждого сигнала клиента определи: лежит ли он внутри разрешённого пространства?

ШАГ 3. Раздели на три группы:
a) СОГЛАСОВАНО — клиент хочет то, что дизайнер одобряет. Конкретные элементы.
b) КОНФЛИКТ — клиент хочет то, что противоречит стандартам. Каждый конфликт требует:
   - точного описания что именно конфликтует
   - объяснения почему это проблема (какой стандарт нарушен)
   - severity: "hard" (дизайнер не сделает) или "soft" (возможен компромисс)
   - 2-3 конкретные альтернативы внутри разрешённого пространства
c) НЕТ ДАННЫХ — важные параметры, по которым нет ни сигнала от клиента, ни ограничения дизайнера

ШАГ 4. Если профиль дизайнера не заполнен или пустой — напиши это явно в summary и
сформируй agreed_elements только из сигналов клиента.

НЕ придумывай конфликты там, где их нет.
НЕ соглашайся с чем попало — дизайнер имеет стандарты.
НЕ усредняй ("немного глянца") — либо принято, либо объяснён конфликт.

Ответь СТРОГО вызовом функции resolve_style_result.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientTasteResult, designerProfileText, styleNarrowingResult } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("VITE_OPENAI_KEY") || Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tasteBlock = clientTasteResult
      ? [
          "=== ВКУС КЛИЕНТА (результат анализа) ===",
          clientTasteResult.summary ? `Резюме: ${clientTasteResult.summary}` : "",
          clientTasteResult.dominant_signals?.length
            ? "Доминирующие сигналы:\n" +
              clientTasteResult.dominant_signals
                .map((s: any) => `- [${s.strength}] ${s.signal} (${s.source})`)
                .join("\n")
            : "",
          clientTasteResult.rejected_elements?.length
            ? "Клиент отвергает:\n" + clientTasteResult.rejected_elements.map((e: string) => `- ${e}`).join("\n")
            : "",
          clientTasteResult.contradictions?.length
            ? "Противоречия клиента:\n" +
              clientTasteResult.contradictions
                .map((c: any) => `- ${c.description} (${c.element_a} vs ${c.element_b})`)
                .join("\n")
            : "",
        ]
          .filter(Boolean)
          .join("\n\n")
      : "Анализ вкуса клиента не проведён.";

    const narrowingBlock = styleNarrowingResult
      ? `\n\n=== РЕЗУЛЬТАТ STYLE NARROWING ===\n${
          typeof styleNarrowingResult === "string"
            ? styleNarrowingResult
            : JSON.stringify(styleNarrowingResult, null, 2)
        }`
      : "";

    const profileBlock = designerProfileText
      ? `\n\n=== СТАНДАРТЫ ДИЗАЙНЕРА ===\n${designerProfileText}`
      : "\n\n=== СТАНДАРТЫ ДИЗАЙНЕРА ===\nПрофиль дизайнера не заполнен.";

    const userMessage = tasteBlock + narrowingBlock + profileBlock;

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
              name: "resolve_style_result",
              description: "Результат согласования стиля дизайнера и вкуса клиента",
              parameters: {
                type: "object",
                properties: {
                  agreed_elements: {
                    type: "array",
                    description: "Элементы, которые клиент хочет и дизайнер принимает",
                    items: {
                      type: "object",
                      properties: {
                        element: { type: "string", description: "Конкретный элемент стиля" },
                        client_signal: { type: "string", description: "Как клиент это выразил" },
                        designer_note: { type: "string", description: "Почему дизайнер это принимает" },
                        layer: {
                          type: "string",
                          enum: ["client", "designer", "both"],
                          description: "Чей сигнал сильнее",
                        },
                      },
                      required: ["element", "client_signal", "designer_note", "layer"],
                    },
                  },
                  conflicts: {
                    type: "array",
                    description: "Конфликты между желанием клиента и стандартами дизайнера",
                    items: {
                      type: "object",
                      properties: {
                        element: { type: "string", description: "Что именно конфликтует" },
                        client_want: { type: "string", description: "Что хочет клиент" },
                        standard_violated: { type: "string", description: "Какой стандарт нарушен" },
                        severity: {
                          type: "string",
                          enum: ["hard", "soft"],
                          description: "hard = дизайнер не сделает, soft = возможен компромисс",
                        },
                        alternatives: {
                          type: "array",
                          items: { type: "string" },
                          description: "2-3 конкретные альтернативы в рамках стандартов дизайнера",
                        },
                      },
                      required: ["element", "client_want", "standard_violated", "severity", "alternatives"],
                    },
                  },
                  gaps: {
                    type: "array",
                    description: "Важные параметры без данных ни от клиента, ни от дизайнера",
                    items: { type: "string" },
                  },
                  summary: {
                    type: "string",
                    description: "Краткое резюме: что принято, сколько конфликтов и общий тон согласования",
                  },
                },
                required: ["agreed_elements", "conflicts", "gaps", "summary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "resolve_style_result" } },
        temperature: 0.3,
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
    console.error("resolve-style error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
