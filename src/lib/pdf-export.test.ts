import { describe, expect, it } from "vitest";
import { buildContractPdfBodyHtml } from "./pdf-export";

describe("contract PDF structure", () => {
  it("builds a client-facing contract appendix without working questions", () => {
    const html = buildContractPdfBodyHtml(
      {
        project: { id: "project-1", name: "Баня Ильясово", raw_input: "натуральные материалы" },
        brief: {
          users_of_space: "семья",
          scenarios: "баня по выходным",
          constraints_practical: "простой уход",
          budget: "2 млн",
        },
        rooms: [{ name: "Парная", room_type: "bathroom", dimensions_text: "5.8 м²" }],
        issues: [{ type: "contradiction", title: "Рабочий конфликт", evidence: "внутренний лог" }],
        questions: [{ priority: "important", text: "Рабочий вопрос без фиксации" }],
        blocks: [
          {
            block_type: "atmosphere",
            caption: "Спокойная природная атмосфера",
            board_images: [{ url: "https://cdn.test/atmosphere.jpg", note: "теплый свет" }],
          },
          {
            block_type: "palette",
            caption: "Теплая природная палитра",
            color_chips: [{ hex: "#D8C7A7", name: "Теплый камень", role: "base", ral: "RAL 1019" }],
          },
          {
            block_type: "materials",
            caption: "Натуральное дерево и камень с практичными аналогами только после согласования",
            board_images: [{ url: "https://cdn.test/materials.jpg", note: "дерево" }],
          },
          {
            block_type: "lighting",
            caption: "Мягкий сценарный свет",
            lighting_zones: [{ zone: "парная", scenario: "вечер", type: "скрытая подсветка", kelvin: "2700K" }],
            board_images: [{ url: "https://cdn.test/light.jpg", note: "2700K" }],
          },
          {
            block_type: "furniture",
            caption: "Компактная мебель с безопасными проходами",
            board_images: [{ url: "https://cdn.test/furniture.jpg", note: "компактная лавка" }],
          },
        ],
      },
      "approved",
      {
        documentVersion: "approved v2",
        generatedAt: "2026-06-25T12:00:00.000Z",
        changes: ["Изменена бюджетная рамка."],
      }
    );

    expect(html).toContain("Приложение к договору");
    expect(html).toContain("Версия документа");
    expect(html).toContain("approved v2");
    expect(html).toContain("Изменения версии");
    expect(html).toContain("Изменена бюджетная рамка.");
    expect(html).toContain("Назначение документа");
    expect(html).toContain("Исходные вводные");
    expect(html).toContain("Утвержденная дизайн-формула");
    expect(html).toContain("Палитра");
    expect(html).toContain("Материалы");
    expect(html).toContain("Освещение");
    expect(html).toContain("Мебель и эргономика");
    expect(html).toContain("Бюджетная рамка");
    expect(html).toContain("подлежит уточнению");
    expect(html).toContain("<figure class=\"img-wrap\">");
    expect(html).toContain("<figcaption class=\"image-note\"><span>Решение: теплый свет</span><span>Источник: источник зафиксирован в борде</span></figcaption>");
    expect(html).toContain("<figcaption class=\"image-note\"><span>Решение: 2700K</span><span>Источник: источник зафиксирован в борде</span></figcaption>");
    expect(html).not.toContain("Уточняющие вопросы");
    expect(html).not.toContain("Рабочий вопрос без фиксации");
    expect(html).not.toContain("Рабочий конфликт");
  });

  it("uses image source metadata in figure captions", () => {
    const html = buildContractPdfBodyHtml({
      project: { id: "project-2", name: "Source test" },
      brief: {},
      rooms: [],
      issues: [],
      questions: [],
      blocks: [
        {
          block_type: "materials",
          caption: "Натуральное дерево как основной материал",
          board_images: [
            {
              url: "https://cdn.test/materials.jpg",
              note: "термодерево для влажной зоны",
              source_type: "client_reference",
            },
          ],
        },
      ],
    });

    expect(html).toContain("Решение: термодерево для влажной зоны");
    expect(html).toContain("Источник: клиентский референс");
    expect(html).not.toContain("<div class=\"image-note\">термодерево для влажной зоны</div>");
  });

  it("prioritizes approved image sources in contract PDF figures", () => {
    const html = buildContractPdfBodyHtml({
      project: { id: "project-3", name: "Image order" },
      brief: {},
      rooms: [],
      issues: [],
      questions: [],
      blocks: [
        {
          block_type: "lighting",
          caption: "Мягкий сценарный свет",
          board_images: [
            {
              url: "https://cdn.test/stock.jpg",
              note: "стоковый свет",
              source_type: "stock_reference",
            },
            {
              url: "https://cdn.test/client.jpg",
              note: "свет из клиентского референса",
              source_type: "client_reference",
            },
          ],
        },
      ],
    });

    expect(html.indexOf("https://cdn.test/client.jpg")).toBeLessThan(html.indexOf("https://cdn.test/stock.jpg"));
    expect(html).toContain("Источник: клиентский референс");
    expect(html).toContain("Источник: стоковый референс");
  });
});
