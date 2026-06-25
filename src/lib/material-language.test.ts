import { describe, expect, it } from "vitest";
import {
  hasExplicitArtificialMaterialRequest,
  mentionsNaturalMaterial,
  normalizeMaterialConflictIssue,
} from "./material-language";

describe("material language normalization", () => {
  it("does not treat natural material wishes as artificial material requests", () => {
    const text = "Клиент просит натуральное дерево, камень и спокойные природные фактуры";

    expect(mentionsNaturalMaterial(text)).toBe(true);
    expect(hasExplicitArtificialMaterialRequest(text)).toBe(false);
  });

  it("rewrites unsupported artificial-material conflicts as designer proposals", () => {
    const issue = normalizeMaterialConflictIssue({
      type: "contradiction",
      title: "Клиент хочет искусственные материалы",
      evidence: "Нужны натуральное дерево и простой уход",
      impact: "Конфликт материалов",
      suggestion: "Использовать искусственные материалы",
    });

    expect(issue.title).toBe("Практичный аналог материалов требует согласования");
    expect(issue.impact).toContain("Нельзя записывать");
    expect(issue.suggestion).toContain("предложение дизайнера");
    expect(issue.evidence).toContain("Источник/цитата");
  });

  it("keeps artificial-material conflicts when the source explicitly says it", () => {
    const issue = normalizeMaterialConflictIssue({
      type: "contradiction",
      title: "Клиент хочет искусственные материалы",
      evidence: "Клиент написал: хочу искусственный камень",
      impact: "Нужно уточнить материал",
      suggestion: "Уточнить допустимые аналоги",
    });

    expect(issue.title).toBe("Клиент хочет искусственные материалы");
    expect(issue.evidence).toContain("искусственный камень");
  });
});
