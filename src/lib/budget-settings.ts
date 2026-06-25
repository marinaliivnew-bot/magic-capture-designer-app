import type { BudgetCalculationOptions, BudgetRegion, BudgetSegment } from "./budget-calculator";

export interface StoredBudgetSettings {
  segment?: BudgetSegment;
  region?: BudgetRegion;
  manualRateMultiplier?: number;
}

export const DEFAULT_BUDGET_SETTINGS: StoredBudgetSettings = {
  region: "regions",
  manualRateMultiplier: 1,
};

export function getBudgetSettingsStorageKey(projectId?: string | null) {
  return projectId ? `project_${projectId}_budget_settings` : "";
}

export function normalizeBudgetSettings(value: unknown): StoredBudgetSettings {
  const data = value && typeof value === "object" ? value as StoredBudgetSettings : {};
  const multiplier = Number(data.manualRateMultiplier);
  return {
    segment: data.segment,
    region: data.region || DEFAULT_BUDGET_SETTINGS.region,
    manualRateMultiplier: Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1,
  };
}

export function loadBudgetSettings(projectId?: string | null): StoredBudgetSettings {
  const key = getBudgetSettingsStorageKey(projectId);
  if (!key || typeof localStorage === "undefined") return DEFAULT_BUDGET_SETTINGS;
  try {
    return normalizeBudgetSettings(JSON.parse(localStorage.getItem(key) || "{}"));
  } catch {
    return DEFAULT_BUDGET_SETTINGS;
  }
}

export function saveBudgetSettings(projectId: string | undefined | null, settings: StoredBudgetSettings) {
  const key = getBudgetSettingsStorageKey(projectId);
  if (!key || typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(normalizeBudgetSettings(settings)));
}

export function toBudgetCalculationOptions(settings: StoredBudgetSettings): BudgetCalculationOptions {
  return normalizeBudgetSettings(settings);
}
