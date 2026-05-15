export interface RenderPromptParams {
  stylistics: string;
  dimensions: string;
  materials: string;
  palette: string;
  lighting: string;
  segment: string;
  negatives: string;
}

export const RENDER_PARAM_LABELS: Record<keyof RenderPromptParams, string> = {
  stylistics: "Стилистика",
  dimensions: "Габариты",
  materials: "Материалы",
  palette: "Палитра RAL / NCS",
  lighting: "Освещение",
  segment: "Сегмент",
  negatives: "Негативные указания",
};

export function extractRenderParams(
  blocks: any[],
  brief: any,
  rooms: any[]
): RenderPromptParams {
  const atmosphereBlock = blocks.find((b) => b.block_type === "atmosphere");
  const paletteBlock = blocks.find((b) => b.block_type === "palette");
  const materialsBlock = blocks.find((b) => b.block_type === "materials");
  const lightingBlock = blocks.find((b) => b.block_type === "lighting");

  // Stylistics: atmosphere caption + style_likes
  const parts = [atmosphereBlock?.caption, brief?.style_likes].filter(Boolean);
  const stylistics = parts.join(". ");

  // Dimensions: rooms with dimensions
  const roomDims = rooms
    .map((r) => (r.dimensions_text ? `${r.name} ${r.dimensions_text}` : r.name))
    .join(", ");
  const dimensions = roomDims;

  // Materials: materials block caption
  const materials = materialsBlock?.caption || "";

  // Palette: color chips with RAL/NCS codes
  const colorChips: any[] = paletteBlock?.color_chips || [];
  const palette = colorChips
    .map((c) => {
      const parts: string[] = [c.name];
      if (c.ral) parts.push(c.ral);
      if (c.role) parts.push(`[${c.role}]`);
      return parts.join(" ");
    })
    .join(", ");

  // Lighting: lighting zones or caption
  const lightingZones: any[] = lightingBlock?.lighting_zones || [];
  const lighting =
    lightingZones.length > 0
      ? lightingZones
          .map((z) =>
            [z.zone, z.scenario, z.kelvin ? `${z.kelvin}K` : ""]
              .filter(Boolean)
              .join(" — ")
          )
          .join("; ")
      : lightingBlock?.caption || "";

  // Segment: from budget
  const segment = brief?.budget || "";

  // Negatives: style_dislikes + constraints_practical
  const negatives = [brief?.style_dislikes, brief?.constraints_practical]
    .filter(Boolean)
    .join(". ");

  return { stylistics, dimensions, materials, palette, lighting, segment, negatives };
}

export function assembleRenderPrompt(params: RenderPromptParams): string {
  const positive: string[] = [];

  if (params.stylistics) positive.push(params.stylistics);
  if (params.dimensions) positive.push(`Помещение: ${params.dimensions}`);
  if (params.materials) positive.push(`Материалы: ${params.materials}`);
  if (params.palette) positive.push(`Палитра (RAL/NCS): ${params.palette}`);
  if (params.lighting) positive.push(`Освещение: ${params.lighting}`);
  if (params.segment) positive.push(`Сегмент: ${params.segment}`);

  let prompt = positive.join(".\n");

  if (params.negatives) {
    prompt += `\n\n--no ${params.negatives}`;
  }

  return prompt;
}
