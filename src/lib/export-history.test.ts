import { describe, expect, it } from "vitest";
import { createExportHistoryEntry } from "./export-history";

const baseData = {
  project: { id: "project-1", name: "Баня Ильясово" },
  brief: { budget: "2 млн", timeline: "июль" },
  rooms: [{ name: "Парная", room_type: "bathroom", dimensions_text: "5.8 м²" }],
  issues: [],
  questions: [],
  blocks: [{ block_type: "materials", caption: "дерево", board_images: [] }],
};

describe("export history", () => {
  it("increments document versions across draft and approved exports", () => {
    const first = createExportHistoryEntry(baseData, "working", "draft", []);
    const second = createExportHistoryEntry(
      {
        ...baseData,
        brief: { ...baseData.brief, budget: "2.4 млн" },
        blocks: [{ block_type: "materials", caption: "дерево и камень", board_images: [] }],
      },
      "contract",
      "approved",
      [first]
    );

    expect(first.versionLabel).toBe("draft v1");
    expect(second.versionLabel).toBe("approved v2");
    expect(second.changes).toContain("Статус изменен: draft → approved.");
    expect(second.changes).toContain("Изменена бюджетная рамка.");
    expect(second.changes).toContain("Обновлен состав concept board.");
  });
});
