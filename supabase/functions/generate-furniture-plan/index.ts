import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-session-id",
};

const SYSTEM_PROMPT = `Ты — эксперт по расстановке мебели в интерьере.
Генерируй JSON-план расстановки мебели по заданным параметрам комнаты.

ПРАВИЛА:
1. Координаты (x, y) — от левого верхнего угла комнаты, в метрах.
   x — горизонталь: 0 = левая стена. y — вертикаль: 0 = верхняя стена.
2. После rotation=0 размеры width×depth. При rotation=90 предмет занимает depth по X и width по Y.
3. Мебель не выходит за границы: x + effectiveWidth ≤ room_width, y + effectiveDepth ≤ room_length.
4. Мебель не пересекается (проверь все пары!).
5. Проходы между предметами — не менее 60 см. Основной проход — не менее 90 см.
6. Мебель у стен прижимать вплотную: y=0 для северной стены, x=0 для западной и т.д.

СТАНДАРТНЫЕ ГАБАРИТЫ (width × depth):
  sofa: Диван 3-местный 2.2×0.9, Диван 2-местный 1.8×0.85
  armchair: Кресло 0.85×0.85
  coffee_table: Журнальный стол 1.1×0.55
  bed: Двуспальная кровать 1.6×2.0, Односпальная кровать 0.9×2.0
  wardrobe: Шкаф-купе 1.8×0.6, Шкаф распашной 0.9×0.55
  dining_table: Обеденный стол на 4 чел 1.4×0.8, на 6 чел 2.0×0.9
  chair: Стул 0.5×0.5
  tv_unit: ТВ-тумба 1.8×0.4
  desk: Рабочий стол 1.4×0.7
  table: Прикроватная тумбочка 0.5×0.45, Консоль 1.2×0.35
  bathtub: Ванна 1.7×0.75, Ванна угловая 1.5×1.5
  toilet: Унитаз 0.7×0.35
  sink: Раковина 0.6×0.45, Тумба с раковиной 0.8×0.5
  fridge: Холодильник 0.6×0.65
  stove: Варочная поверхность 0.6×0.6, Кухонная плита 0.6×0.6

ДОСТУПНЫЕ ТИПЫ: sofa, bed, table, dining_table, coffee_table, chair, armchair, wardrobe, tv_unit, desk, bathtub, toilet, sink, fridge, stove, other

ЦВЕТ И МАТЕРИАЛ (заполняй для каждого предмета):
- ral: код из палитры RAL Classic, например "RAL 9010", "RAL 7016", "RAL 8017"
- hex: HEX-цвет, соответствующий RAL-коду
- material: материал изготовления, например "Дуб беленый", "МДФ покрашенный", "Ткань рогожка", "Металл порошковый"
- finish: покрытие — одно из: matte / glossy / satin / natural / textured
- price_segment: ценовой сегмент — одно из: economy / mid / premium
- quantity: количество единиц (обычно 1, для стульев/тумбочек может быть 2–6)

Ответь ТОЛЬКО валидным JSON без markdown, без преамбулы:
{
  "room_name": "...",
  "room_width": <число>,
  "room_length": <число>,
  "furniture": [
    {
      "id": "item_1",
      "name": "Диван 3-местный",
      "type": "sofa",
      "width": 2.2,
      "depth": 0.9,
      "x": 0.3,
      "y": 2.8,
      "rotation": 0,
      "ral": "RAL 7044",
      "hex": "#B1B0A7",
      "material": "Ткань рогожка",
      "finish": "textured",
      "price_segment": "mid",
      "quantity": 1
    }
  ],
  "notes": "Краткое описание логики расстановки (1-2 предложения на русском)."
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { roomName, roomType, roomWidth, roomLength, briefScenarios, briefZones, briefUsers } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userMessage = `Комната: ${roomName} (тип: ${roomType})
Размеры: ${roomWidth}м × ${roomLength}м (ширина × длина)

Контекст из брифа:
${briefUsers ? `Проживают: ${briefUsers}` : ""}
${briefScenarios ? `Сценарии: ${briefScenarios}` : ""}
${briefZones ? `Зонирование: ${briefZones}` : ""}

Сгенерируй расстановку мебели для этой комнаты. Учти размеры, сценарии и состав жильцов.`;

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
          { role: "user", content: userMessage },
        ],
        max_tokens: 2000,
        temperature: 0.2,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";

    let plan;
    try {
      // Strip possible markdown fences
      const cleaned = content.replace(/^```json\n?/i, "").replace(/\n?```$/i, "").trim();
      plan = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: content }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(plan), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
