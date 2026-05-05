import { BRIEF_SECTIONS, ROOM_TYPES, PRIORITY_CONFIG, BOARD_BLOCK_TYPES } from "./constants";

interface PdfData {
  project: any;
  brief: any;
  rooms: any[];
  issues: any[];
  questions: any[];
  blocks: any[];
}

interface PdfOptions {
  variant?: "brief" | "full";
  approvalStatus?: "draft" | "approved";
}

function formatDate() {
  return new Date().toLocaleDateString("ru-RU");
}

function formatFilenameDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildColorChipsHtml(colorChips: any[]): string {
  if (!Array.isArray(colorChips) || colorChips.length === 0) return "";
  const chips = colorChips
    .map((chip: any) => {
      const hex = chip.hex?.startsWith("#") ? chip.hex : `#${chip.hex || "cccccc"}`;
      return `<div class="chip">
        <div class="chip-swatch" style="background:${hex}"></div>
        <div class="chip-name">${chip.name || ""}</div>
        <div class="chip-ral">${chip.ral || ""}</div>
        <div class="chip-hex">${hex.toUpperCase()}</div>
      </div>`;
    })
    .join("");
  return `<div class="chip-grid">${chips}</div>`;
}

function buildLightingZonesHtml(zones: any[]): string {
  if (!Array.isArray(zones) || zones.length === 0) return "";
  const rows = zones
    .map(
      (z: any) =>
        `<tr><td class="zone-name">${z.zone || ""}</td><td>${z.scenario || ""}</td><td>${z.type || ""}</td><td class="zone-kelvin">${z.kelvin || ""}</td></tr>`
    )
    .join("");
  return `<table class="zones-table"><thead><tr><th>Зона</th><th>Сценарий</th><th>Тип света</th><th>Цветность</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function generateFullPDF(data: PdfData, options: PdfOptions = {}) {
  const { project, brief, rooms, issues, questions, blocks } = data;
  const variant = options.variant || "full";
  const approvalStatus = options.approvalStatus || "draft";

  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;

  const date = formatDate();
  const fileDate = formatFilenameDate();
  const projectName = project?.name || "Проект";
  const constraints = (project?.constraints as Record<string, string>) || {};

  const docTitle = variant === "brief"
    ? `${projectName}_бриф_${fileDate}`
    : `${projectName}_концепт_${fileDate}`;

  // ── Заголовок ─────────────────────────────────────────────────────────────
  const titleHtml = `<h1>${projectName}</h1><p class="subtitle">${date}</p>`;

  // ── Критерии успеха ────────────────────────────────────────────────────────
  const successCriteriaHtml = brief?.success_criteria
    ? `<h2>Критерии успеха</h2><p>${brief.success_criteria}</p>`
    : "";

  // ── Данные проекта ─────────────────────────────────────────────────────────
  const projectParts: string[] = [];
  if (constraints.budget)
    projectParts.push(`<div class="info-row"><span class="info-label">Бюджет и ограничения</span><span>${constraints.budget}</span></div>`);
  if (constraints.timeline)
    projectParts.push(`<div class="info-row"><span class="info-label">Сроки</span><span>${constraints.timeline}</span></div>`);
  if (constraints.taboos)
    projectParts.push(`<div class="info-row"><span class="info-label">Табу</span><span>${constraints.taboos}</span></div>`);
  if (constraints.must_haves)
    projectParts.push(`<div class="info-row"><span class="info-label">Must-have</span><span>${constraints.must_haves}</span></div>`);
  if (project?.raw_input)
    projectParts.push(`<div class="info-row"><span class="info-label">Заметки</span><span>${project.raw_input}</span></div>`);

  const projectInfoHtml = projectParts.length > 0
    ? `<h2>Данные проекта</h2><div class="info-block">${projectParts.join("")}</div>`
    : "";

  // ── Помещения ──────────────────────────────────────────────────────────────
  const roomsHtml = rooms.length > 0
    ? `<h2>Помещения</h2><table class="rooms-table">${rooms
        .map((r: any) => {
          const typeLabel = ROOM_TYPES.find((t) => t.value === r.room_type)?.label || r.room_type;
          return `<tr><td>${r.name} <span class="dim">(${typeLabel})</span></td><td class="dim">${r.dimensions_text || "—"}</td></tr>`;
        })
        .join("")}</table>`
    : "";

  // ── Бриф ──────────────────────────────────────────────────────────────────
  const briefSections = BRIEF_SECTIONS.filter((s) => s.key !== "success_criteria");
  const briefHtml = `<h2>Бриф</h2>` + briefSections
    .map(
      ({ key, label }) =>
        `<div class="brief-item"><div class="sub-label">${label}</div><p>${(brief as any)?.[key] || "не указано"}</p></div>`
    )
    .join("");

  // ── Противоречия ──────────────────────────────────────────────────────────
  const contradictions = (issues || []).filter((i: any) => i.type === "contradiction");
  const contradictionsHtml = contradictions.length > 0
    ? `<h2>Противоречия</h2>` +
      contradictions
        .map(
          (issue: any) =>
            `<div class="issue"><div class="issue-title">${issue.title}</div>${issue.evidence ? `<p class="evidence">«${issue.evidence}»</p>` : ""}${issue.suggestion ? `<p class="suggestion">${issue.suggestion}</p>` : ""}</div>`
        )
        .join("")
    : "";

  // ── Вопросы ───────────────────────────────────────────────────────────────
  const questionsHtml = (questions || []).length > 0
    ? `<h2>Уточняющие вопросы</h2>` +
      questions
        .map((q: any) => {
          const priorityLabel =
            PRIORITY_CONFIG[q.priority as keyof typeof PRIORITY_CONFIG]?.label || q.priority;
          return `<div class="question"><span class="priority">${priorityLabel}</span>${q.text}${q.answer ? `<p class="answer">Ответ: ${q.answer}</p>` : ""}${q.unlocks ? `<p class="unlocks">Разблокирует: ${q.unlocks}</p>` : ""}</div>`;
        })
        .join("")
    : "";

  // ── Концепт-борд ──────────────────────────────────────────────────────────
  const boardHtml =
    variant === "full" && (blocks || []).length > 0
      ? `<h2>Концепт-борд</h2>` +
        blocks
          .map((block: any) => {
            const label =
              BOARD_BLOCK_TYPES.find((b) => b.type === block.block_type)?.label || block.block_type;

            const chipsHtml =
              block.block_type === "palette"
                ? buildColorChipsHtml(block.color_chips || [])
                : "";

            const zonesHtml =
              block.block_type === "lighting"
                ? buildLightingZonesHtml(block.lighting_zones || [])
                : "";

            const imagesHtml =
              block.block_type !== "palette"
                ? (block.board_images || [])
                    .filter((img: any) => img.url)
                    .map(
                      (img: any) =>
                        `<div class="img-wrap"><img src="${img.url}" alt="${img.note || ""}" class="board-image" />${img.note ? `<div class="image-note">${img.note}</div>` : ""}</div>`
                    )
                    .join("")
                : "";

            return `<div class="board-block">
              <h3>${label}</h3>
              ${block.caption ? `<p class="block-caption">${block.caption}</p>` : ""}
              ${chipsHtml}
              ${zonesHtml}
              ${imagesHtml ? `<div class="image-grid">${imagesHtml}</div>` : ""}
            </div>`;
          })
          .join("")
      : "";

  // ── Блок согласования ─────────────────────────────────────────────────────
  const approvalHtml = `
    <div class="approval-block">
      <h2>Согласование</h2>
      <div class="approval-grid">
        <div class="approval-party">
          <div class="approval-role">Дизайнер</div>
          <div class="approval-line"></div>
          <div class="approval-hint">Подпись / дата</div>
        </div>
        <div class="approval-party">
          <div class="approval-role">Клиент</div>
          <div class="approval-line"></div>
          <div class="approval-hint">Подпись / дата</div>
        </div>
      </div>
    </div>`;

  // ── Футер ─────────────────────────────────────────────────────────────────
  const footerText =
    approvalStatus === "approved"
      ? `Утверждённая версия · Приложение к договору · ${date}`
      : `Draft concept, requires designer review · ${date}`;
  const footerHtml = `<p class="footer">${footerText}</p>`;

  // ── CSS ───────────────────────────────────────────────────────────────────
  const css = `
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1a1a1a;font-size:15px;line-height:1.6;}
h1{font-size:32px;font-weight:300;margin:0 0 4px;}
.subtitle{font-size:13px;color:#888;margin-bottom:40px;}
h2{font-size:18px;font-weight:400;margin:48px 0 16px;border-top:1px solid #e0e0e0;padding-top:24px;}
h3{font-size:15px;font-weight:500;margin:0 0 6px;}
p{margin:0 0 8px;color:#444;}
.sub-label{font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin:0 0 6px;}
.info-block{margin-bottom:8px;}
.info-row{display:flex;gap:16px;padding:6px 0;border-bottom:1px solid #f0f0f0;}
.info-label{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888;min-width:160px;}
.rooms-table{width:100%;border-collapse:collapse;margin-bottom:8px;}
.rooms-table td{padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:14px;}
.dim{color:#888;}
.brief-item{padding:16px 0;border-bottom:1px solid #f0f0f0;}
.issue{margin-bottom:16px;padding-left:16px;border-left:3px solid #c44;}
.issue-title{font-size:15px;font-weight:500;color:#c44;}
.evidence{font-size:13px;color:#888;font-style:italic;margin:4px 0;}
.suggestion{font-size:14px;color:#7a5500;margin:4px 0;}
.question{margin-bottom:12px;padding:8px 0;border-bottom:1px solid #f0f0f0;}
.priority{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;padding:2px 8px;border:1px solid #bbb;margin-right:10px;}
.answer{font-size:14px;color:#7a5500;margin:4px 0 0;}
.unlocks{font-size:12px;color:#888;margin:2px 0 0;}
.board-block{margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #f0f0f0;}
.block-caption{color:#555;font-size:14px;margin:6px 0 12px;}
.image-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px;}
.img-wrap{}
.board-image{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;}
.image-note{font-size:12px;color:#9a7840;margin-top:4px;}
.chip-grid{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0 16px;}
.chip{width:96px;}
.chip-swatch{width:96px;height:72px;border-radius:3px;}
.chip-name{font-size:12px;font-weight:500;margin-top:5px;color:#1a1a1a;}
.chip-ral{font-size:11px;font-family:monospace;color:#888;}
.chip-hex{font-size:10px;font-family:monospace;color:#bbb;}
.zones-table{width:100%;border-collapse:collapse;font-size:13px;margin:12px 0;}
.zones-table th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888;padding:4px 8px 8px 0;border-bottom:1px solid #ddd;}
.zones-table td{padding:7px 8px 7px 0;border-bottom:1px solid #f0f0f0;}
.zone-name{font-weight:500;}
.zone-kelvin{font-family:monospace;color:#888;}
.approval-block{margin-top:48px;}
.approval-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:24px;}
.approval-role{font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-bottom:56px;}
.approval-line{border-bottom:1px solid #555;margin-bottom:6px;}
.approval-hint{font-size:11px;color:#bbb;}
.footer{text-align:center;font-size:12px;color:#aaa;margin-top:56px;font-style:italic;}
@media print{body{margin:20px auto;}h2{page-break-before:auto;}}`;

  printWindow.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docTitle}</title><style>${css}</style></head><body>` +
      titleHtml +
      successCriteriaHtml +
      projectInfoHtml +
      roomsHtml +
      briefHtml +
      contradictionsHtml +
      questionsHtml +
      boardHtml +
      approvalHtml +
      footerHtml +
      `</body></html>`
  );
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 400);
  return true;
}
