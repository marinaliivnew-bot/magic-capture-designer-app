import { describe, expect, it } from "vitest";
import {
  getBlockRationale,
  getClientReferenceAnalysis,
  getConceptBasis,
  getReferenceCoverage,
  getReferenceMatchMatrix,
  getStyleConsistency,
  getStyleFormula,
} from "./concept-rationale";

describe("concept rationale", () => {
  it("builds block rationale from image sources, notes and brief", () => {
    const reasons = getBlockRationale(
      {
        block_type: "materials",
        caption: "Натуральные фактуры дерева и камня",
        board_images: [
          {
            url: "https://cdn.magic-capture.test/materials.jpg",
            source_type: "client_reference",
            source_url: "https://client.example/ref",
            note: "Теплая древесина без глянца",
          },
        ],
      },
      { constraints_practical: "Нужны натуральные материалы и простой уход" }
    );

    expect(reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("клиентский референс"),
        expect.stringContaining("Визуальная проверка"),
        expect.stringContaining("Теплая древесина"),
      ])
    );
  });

  it("separates client reference take and reject notes", () => {
    const analysis = getClientReferenceAnalysis({
      user_refs: [
        {
          url: "https://client.example/ref-1",
          type: "link",
          step: "brief",
          likes: "Берем мягкий свет и натуральный камень",
          dislikes: "Не берем холодный глянец",
          tags: ["свет", "камень"],
        },
      ],
    });

    expect(analysis[0].take).toContain("мягкий свет");
    expect(analysis[0].reject).toContain("холодный глянец");
    expect(analysis[0].clarify).toBe("");
  });

  it("creates a short concept basis for contract PDF", () => {
    const basis = getConceptBasis(
      [
        {
          block_type: "lighting",
          caption: "Мягкий сценарный свет",
          board_images: [{ url: "https://cdn.magic-capture.test/light.jpg", source_type: "client_reference" }],
        },
      ],
      {
        style_likes: "Современная баня с природной спокойной атмосферой",
        user_refs: [{ url: "https://client.example/ref", type: "link", step: "brief", likes: "Нравится теплый свет" }],
      }
    );

    expect(basis.length).toBeGreaterThan(0);
    expect(basis.join(" ")).toContain("Клиентские референсы");
  });

  it("builds a client reference match matrix", () => {
    const brief = {
      user_refs: [
        {
          url: "https://client.example/ref",
          type: "link",
          step: "brief",
          likes: "теплый свет, натуральный камень",
          dislikes: "холодный глянец",
        },
      ],
    };
    const rows = getReferenceMatchMatrix(brief, [
      {
        block_type: "lighting",
        caption: "Используем теплый свет в парной и зоне отдыха",
        board_images: [],
      },
    ]);

    expect(rows[0].extractedSignals).toContain("теплый свет");
    expect(rows[0].usedInConcept[0]).toContain("lighting");
    expect(rows[0].excluded).toContain("холодный глянец");
    expect(rows[0].needsClarification).toContain("натуральный камень");
  });

  it("calculates reference coverage", () => {
    const coverage = getReferenceCoverage(
      {
        user_refs: [
          {
            url: "https://client.example/ref",
            type: "link",
            step: "brief",
            likes: "теплый свет, натуральный камень",
          },
        ],
      },
      [{ block_type: "lighting", caption: "теплый свет", board_images: [] }]
    );

    expect(coverage.signalCount).toBe(2);
    expect(coverage.usedCount).toBe(1);
    expect(coverage.ratio).toBe(0.5);
  });

  it("builds a unified style formula from brief and client references", () => {
    const formula = getStyleFormula({
      style_likes: "Современная баня, спокойное дерево, теплый камень",
      style_dislikes: "холодный глянец",
      user_refs: [
        {
          url: "https://client.example/ref",
          type: "link",
          step: "brief",
          likes: "мягкий свет",
          tags: ["натуральный камень"],
        },
      ],
    });

    expect(formula.phrase).toContain("Современная баня");
    expect(formula.terms).toEqual(expect.arrayContaining(["современная", "дерево", "камень"]));
    expect(formula.negativeTerms).toContain("глянец");
  });

  it("detects stylistic conflicts in materials and furniture blocks", () => {
    const result = getStyleConsistency(
      {
        style_likes: "спокойное дерево, натуральный камень, мягкий теплый свет",
        style_dislikes: "холодный глянец",
      },
      [
        {
          block_type: "materials",
          caption: "глянцевый пластик и кислотные панели",
          board_images: [{ note: "глянец" }],
        },
        {
          block_type: "furniture",
          caption: "дерево и камень поддерживают мягкий свет",
          board_images: [],
        },
      ]
    );

    expect(result.conflicts.map((conflict) => conflict.blockType)).toContain("materials");
    expect(result.conflicts.map((conflict) => conflict.blockType)).not.toContain("furniture");
  });
});
