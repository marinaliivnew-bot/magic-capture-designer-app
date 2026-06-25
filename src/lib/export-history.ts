export type ExportVariant = "working" | "contract";
export type ExportApprovalStatus = "draft" | "approved";

export interface ExportHistoryEntry {
  id: string;
  variant: ExportVariant;
  approvalStatus: ExportApprovalStatus;
  versionNumber: number;
  versionLabel: string;
  generatedAt: string;
  changes: string[];
  snapshot: Record<string, unknown>;
}

interface ExportHistoryInput {
  project: any;
  brief: any;
  rooms: any[];
  issues: any[];
  questions: any[];
  blocks: any[];
}

function storageKey(projectId?: string | null) {
  return projectId ? `project_${projectId}_export_history` : "";
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function blockFingerprint(block: any) {
  const images = Array.isArray(block?.board_images) ? block.board_images : [];
  return {
    type: block?.block_type,
    caption: text(block?.caption),
    images: images.map((img: any) => text(img?.url)).filter(Boolean),
    notes: images.map((img: any) => text(img?.note)).filter(Boolean),
    colorChips: Array.isArray(block?.color_chips) ? block.color_chips.length : 0,
    lightingZones: Array.isArray(block?.lighting_zones) ? block.lighting_zones.length : 0,
  };
}

export function buildExportSnapshot(data: ExportHistoryInput, variant: ExportVariant, approvalStatus: ExportApprovalStatus) {
  return {
    variant,
    approvalStatus,
    projectName: text(data.project?.name),
    budget: text(data.brief?.budget),
    timeline: text(data.brief?.timeline),
    constraints: text(data.brief?.constraints_practical),
    rooms: (data.rooms || []).map((room) => ({
      name: text(room?.name),
      type: text(room?.room_type),
      dimensions: text(room?.dimensions_text),
    })),
    openQuestionCount: (data.questions || []).filter((q) => !text(q?.answer)).length,
    issueCount: (data.issues || []).length,
    blocks: (data.blocks || []).map(blockFingerprint),
  };
}

function sameJson(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function describeExportChanges(previous: ExportHistoryEntry | null, nextSnapshot: Record<string, unknown>) {
  if (!previous) return ["Первый экспорт документа."];
  const previousSnapshot = previous.snapshot || {};
  const changes: string[] = [];

  if (previousSnapshot.approvalStatus !== nextSnapshot.approvalStatus) {
    changes.push(`Статус изменен: ${previousSnapshot.approvalStatus || "—"} → ${nextSnapshot.approvalStatus || "—"}.`);
  }
  if (previousSnapshot.budget !== nextSnapshot.budget) changes.push("Изменена бюджетная рамка.");
  if (previousSnapshot.timeline !== nextSnapshot.timeline) changes.push("Изменены сроки проекта.");
  if (previousSnapshot.constraints !== nextSnapshot.constraints) changes.push("Изменены ограничения или табу.");
  if (!sameJson(previousSnapshot.rooms, nextSnapshot.rooms)) changes.push("Обновлены помещения или площади.");
  if (!sameJson(previousSnapshot.blocks, nextSnapshot.blocks)) changes.push("Обновлен состав concept board.");
  if (previousSnapshot.openQuestionCount !== nextSnapshot.openQuestionCount) changes.push("Изменилось количество открытых вопросов.");
  if (previousSnapshot.issueCount !== nextSnapshot.issueCount) changes.push("Изменилось количество зафиксированных проблем.");

  return changes.length > 0 ? changes : ["Существенных изменений относительно предыдущего экспорта не найдено."];
}

export function loadExportHistory(projectId?: string | null): ExportHistoryEntry[] {
  const key = storageKey(projectId);
  if (!key || typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveExportHistory(projectId: string | undefined | null, history: ExportHistoryEntry[]) {
  const key = storageKey(projectId);
  if (!key || typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(history));
}

export function createExportHistoryEntry(
  data: ExportHistoryInput,
  variant: ExportVariant,
  approvalStatus: ExportApprovalStatus,
  history: ExportHistoryEntry[] = loadExportHistory(data.project?.id)
): ExportHistoryEntry {
  const snapshot = buildExportSnapshot(data, variant, approvalStatus);
  const versionNumber = history.length + 1;
  const statusLabel = approvalStatus === "approved" ? "approved" : "draft";
  const previous = history[history.length - 1] || null;

  return {
    id: `${Date.now()}-${versionNumber}`,
    variant,
    approvalStatus,
    versionNumber,
    versionLabel: `${statusLabel} v${versionNumber}`,
    generatedAt: new Date().toISOString(),
    changes: describeExportChanges(previous, snapshot),
    snapshot,
  };
}

export function appendExportHistoryEntry(projectId: string | undefined | null, entry: ExportHistoryEntry) {
  const next = [...loadExportHistory(projectId), entry];
  saveExportHistory(projectId, next);
  return next;
}
