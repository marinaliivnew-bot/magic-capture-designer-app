import { describe, expect, it } from "vitest";
import { detectConflicts } from "./conflict-detector";

describe("detectConflicts material wording", () => {
  it("does not invent an artificial-material conflict for natural materials plus practical care", () => {
    const conflicts = detectConflicts(
      {
        style_likes: "Натуральное дерево, камень, спокойная природная баня",
        constraints_practical: "Нужен простой уход, влагостойкость и практичные поверхности",
        users_of_space: "Семья использует баню по выходным",
        budget: "2 млн",
      },
      [],
      { raw_input: "баня Ильясово: натуральные материалы, без глянца" }
    );

    const text = conflicts.map((conflict) => `${conflict.title} ${conflict.description}`).join(" ");

    expect(text.toLowerCase()).not.toContain("искусствен");
    expect(text.toLowerCase()).not.toContain("ненатурал");
  });
});
