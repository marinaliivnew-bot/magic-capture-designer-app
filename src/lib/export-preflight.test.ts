import { describe, expect, it } from "vitest";
import { runExportPreflight } from "./export-preflight";

const validImage = (id: string, url = `https://cdn.magic-capture.test/${id}.jpg`) => ({
  id,
  url,
  source_type: "client_reference",
  note: "Подтверждено референсом клиента",
});

const baseBlocks = [
  {
    block_type: "atmosphere",
    caption: "Спокойная природная атмосфера",
    board_images: [validImage("atmosphere-1"), validImage("atmosphere-2")],
  },
  {
    block_type: "palette",
    color_chips: [{ hex: "#d8c7a7", name: "Теплый камень", role: "base", ral: "RAL 1019" }],
    sources: ["brief"],
  },
  {
    block_type: "materials",
    caption: "Натуральные фактуры дерева и камня",
    board_images: [validImage("materials-1"), validImage("materials-2")],
  },
  {
    block_type: "furniture",
    caption: "Компактная мебель с безопасными проходами",
    board_images: [validImage("furniture-1")],
  },
  {
    block_type: "lighting",
    caption: "Мягкий сценарный свет",
    board_images: [validImage("lighting-1"), validImage("lighting-2")],
  },
];

describe("runExportPreflight", () => {
  it("fails when the second lighting reference is empty", () => {
    const blocks = baseBlocks.map((block) =>
      block.block_type === "lighting"
        ? {
            ...block,
            board_images: [validImage("lighting-1"), { id: "lighting-2", url: "" }],
          }
        : block
    );

    const result = runExportPreflight({ blocks, questions: [] });

    expect(result.status).toBe("fail");
    expect(result.blockingIssues.map((item) => item.id)).toContain("empty-image-lighting-2");
    expect(result.blockingIssues.map((item) => item.id)).toContain("too-few-images-lighting");
  });

  it("fails when a required image is marked as failed after load check", () => {
    const blocks = baseBlocks.map((block) =>
      block.block_type === "lighting"
        ? {
            ...block,
            board_images: [validImage("lighting-1"), { ...validImage("lighting-2"), load_status: "failed" }],
          }
        : block
    );

    const result = runExportPreflight({ blocks, questions: [] });

    expect(result.status).toBe("fail");
    expect(result.blockingIssues.map((item) => item.id)).toContain("unavailable-image-lighting-2");
    expect(result.blockingIssues.map((item) => item.id)).toContain("too-few-images-lighting");
  });

  it("passes when required blocks, images and traces are present", () => {
    const result = runExportPreflight({ blocks: baseBlocks, questions: [] });

    expect(result.status).toBe("pass");
    expect(result.issues).toHaveLength(0);
  });

  it("blocks contract export when a required block has only unexplained auto images", () => {
    const blocks = baseBlocks.map((block) =>
      block.block_type === "materials"
        ? {
            ...block,
            board_images: [
              { id: "materials-auto-1", url: "https://cdn.magic-capture.test/a.jpg", source_type: "unsplash_auto" },
              { id: "materials-auto-2", url: "https://cdn.magic-capture.test/b.jpg", source_type: "stock_reference" },
            ],
          }
        : block
    );

    const result = runExportPreflight({ blocks, questions: [] });

    expect(result.status).toBe("fail");
    expect(result.blockingIssues.map((item) => item.id)).toContain("no-approved-image-source-materials");
    expect(result.blockingIssues.map((item) => item.id)).toContain("unexplained-auto-image-materials-1");
  });

  it("warns before export when client reference signals are not represented", () => {
    const result = runExportPreflight({
      blocks: baseBlocks,
      questions: [],
      brief: {
        user_refs: [
          {
            url: "https://client.example/ref",
            type: "link",
            step: "brief",
            likes: "арочные окна, латунные детали, холодный мрамор",
          },
        ],
      },
    });

    expect(result.status).toBe("fail");
    expect(result.blockingIssues.map((item) => item.id)).toContain("low-client-reference-coverage");
  });

  it("blocks contract export when materials conflict with the style formula", () => {
    const blocks = baseBlocks.map((block) =>
      block.block_type === "materials"
        ? {
            ...block,
            caption: "Холодный глянец и пластиковые панели",
            board_images: [
              validImage("materials-1"),
              { ...validImage("materials-2"), note: "глянец" },
            ],
          }
        : block
    );

    const result = runExportPreflight({
      blocks,
      questions: [],
      brief: {
        style_likes: "теплое дерево, натуральный камень, мягкий свет",
        style_dislikes: "холодный глянец",
      },
    });

    expect(result.status).toBe("fail");
    expect(
      result.blockingIssues.some((item) => item.id.startsWith("style-conflict-materials"))
    ).toBe(true);
  });

  it("accepts calculated budget methodology when rooms have area", () => {
    const result = runExportPreflight({
      blocks: baseBlocks,
      questions: [],
      brief: {
        budget: "2 млн",
      },
      rooms: [
        { name: "Парная", room_type: "bathroom", dimensions_text: "5.8 м²" },
      ],
    });

    expect(result.blockingIssues.map((item) => item.id)).not.toContain("missing-budget-methodology");
  });
});
