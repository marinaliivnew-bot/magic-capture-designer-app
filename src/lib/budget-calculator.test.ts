import { describe, expect, it } from "vitest";
import { calculateBudget } from "./budget-calculator";

describe("calculateBudget methodology", () => {
  it("returns a client-safe methodology, range and exclusions", () => {
    const result = calculateBudget(
      {
        budget: "2 млн",
        style_likes: "натуральное дерево и камень",
        constraints_practical: "нужны практичные влагостойкие поверхности",
      },
      [
        { name: "Парная", room_type: "bathroom", dimensions_text: "5.8 м²" },
        { name: "Комната отдыха", room_type: "living", dimensions_text: "" },
      ],
      { raw_input: "баня Ильясово" }
    );

    expect(result.canShowInContract).toBe(true);
    expect(result.estimateRange?.min).toBeGreaterThan(0);
    expect(result.assumptions.join(" ")).toContain("не является сметой подрядчика");
    expect(result.excludes.join(" ")).toContain("Помещения без площади");
    expect(result.missingAreaRooms).toContain("Комната отдыха");
  });

  it("applies configurable segment, region and manual rate multiplier", () => {
    const base = calculateBudget(
      { budget: "2 млн" },
      [{ name: "Парная", room_type: "bathroom", dimensions_text: "10 м²" }],
      { raw_input: "баня" },
      { segment: "middle", region: "regions", manualRateMultiplier: 1 }
    );
    const adjusted = calculateBudget(
      { budget: "2 млн" },
      [{ name: "Парная", room_type: "bathroom", dimensions_text: "10 м²" }],
      { raw_input: "баня" },
      { segment: "premium", region: "moscow", manualRateMultiplier: 1.1 }
    );

    expect(adjusted.totalEstimate).toBeGreaterThan(base.totalEstimate);
    expect(adjusted.segment).toBe("premium");
    expect(adjusted.region).toBe("moscow");
    expect(adjusted.regionCoefficient).toBeGreaterThan(1);
    expect(adjusted.manualRateMultiplier).toBe(1.1);
    expect(adjusted.assumptions.join(" ")).toContain("скорректирован дизайнером");
    expect(adjusted.methodologyDate).toBe("2026-06-25");
  });
});
