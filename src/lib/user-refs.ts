export interface UserRef {
  url: string;
  type: "file" | "link";
  step: string;
  likes?: string;
  dislikes?: string;
  tags?: string[];
}

export interface UserRefStructured {
  url: string;
  type: "file" | "link";
  step: string;
  likes: string;
  dislikes: string;
  tags: string[];
  summary: string;
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter(Boolean);
}

export function normalizeUserRef(value: any, fallbackStep = "project"): UserRef | null {
  if (!value || typeof value !== "object" || typeof value.url !== "string" || !value.url.trim()) {
    return null;
  }

  return {
    url: value.url,
    type: value.type === "link" ? "link" : "file",
    step: typeof value.step === "string" && value.step.trim() ? value.step : fallbackStep,
    likes: typeof value.likes === "string" ? value.likes : typeof value.comment === "string" ? value.comment : "",
    dislikes: typeof value.dislikes === "string" ? value.dislikes : "",
    tags: normalizeTags(value.tags),
  };
}

export function normalizeUserRefs(value: unknown, fallbackStep = "project"): UserRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeUserRef(item, fallbackStep))
    .filter((item): item is UserRef => Boolean(item));
}

export function serializeUserRefs(refs: UserRef[]) {
  return refs.map((ref) => ({
    url: ref.url,
    type: ref.type,
    step: ref.step,
    likes: ref.likes?.trim() || "",
    dislikes: ref.dislikes?.trim() || "",
    tags: normalizeTags(ref.tags),
  }));
}

export function buildStructuredUserRefs(refs: UserRef[]): UserRefStructured[] {
  return refs.map((ref) => {
    const likes = ref.likes?.trim() || "";
    const dislikes = ref.dislikes?.trim() || "";
    const tags = normalizeTags(ref.tags);
    const summaryParts = [likes, dislikes ? `Не подходит: ${dislikes}` : "", tags.length ? `Теги: ${tags.join(", ")}` : ""].filter(Boolean);

    return {
      url: ref.url,
      type: ref.type,
      step: ref.step,
      likes,
      dislikes,
      tags,
      summary: summaryParts.join(". "),
    };
  });
}

export function parseTagsInput(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function formatTagsInput(tags: string[] | undefined): string {
  return normalizeTags(tags).join(", ");
}

export function collectTasteSignals(refs: UserRef[]) {
  const likes = refs
    .map((ref) => ref.likes?.trim())
    .filter(Boolean) as string[];
  const dislikes = refs
    .map((ref) => ref.dislikes?.trim())
    .filter(Boolean) as string[];
  const tags = Array.from(new Set(refs.flatMap((ref) => normalizeTags(ref.tags))));

  return { likes, dislikes, tags };
}

export function buildTasteSummaryFromRefs(refs: UserRef[]) {
  const { likes, dislikes, tags } = collectTasteSignals(refs);

  return {
    likesText: likes.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    dislikesText: dislikes.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    tagsText: tags.join(", "),
  };
}
