import { BRIEF_SECTIONS, ROOM_TYPES, PRIORITY_CONFIG, BOARD_BLOCK_TYPES } from "./constants";
import { getBlockRationale, getConceptBasis } from "./concept-rationale";
import { calculateBudget, SEGMENT_LABELS } from "./budget-calculator";
import { loadBudgetSettings, toBudgetCalculationOptions } from "./budget-settings";

interface PdfData {
  project: any;
  brief: any;
  rooms: any[];
  issues: any[];
  questions: any[];
  blocks: any[];
}

interface PdfOptions {
  variant?: "brief" | "full" | "working" | "contract";
  approvalStatus?: "draft" | "approved";
  documentVersion?: string;
  generatedAt?: string;
  changes?: string[];
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

function buildConceptBasisHtml(items: string[]): string {
  if (!Array.isArray(items) || items.length === 0) return "";
  return `<h2>Основание концепции</h2><ul class="basis-list">${items
    .map((item) => `<li>${item}</li>`)
    .join("")}</ul>`;
}

function getBlock(blocks: any[], type: string) {
  return (blocks || []).find((block) => block?.block_type === type);
}

const IMAGE_SOURCE_LABELS: Record<string, string> = {
  client_reference: "клиентский референс",
  designer_reference: "референс дизайнера",
  master_reference: "мастер-референс",
  generated_reference: "сгенерированный визуал",
  stock_reference: "стоковый референс",
  unsplash_auto: "автоподбор Unsplash",
  user_upload: "ручная загрузка",
  designer_auto: "подбор дизайнера",
};

function compactText(value: unknown, maxLength = 110) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function getImageSourceLabel(img: any) {
  if (img?.attribution) return compactText(img.attribution, 90);
  if (img?.source_type) return IMAGE_SOURCE_LABELS[img.source_type] || img.source_type;
  if (img?.source_url) return compactText(img.source_url, 90);
  return "источник зафиксирован в борде";
}

function buildImageCaptionHtml(img: any, block: any) {
  const decision = compactText(img?.note || block?.caption || "визуальный ориентир", 120);
  const source = getImageSourceLabel(img);
  return `<figcaption class="image-note"><span>Решение: ${decision}</span><span>Источник: ${source}</span></figcaption>`;
}

function isPreferredContractImage(img: any) {
  return ["master_reference", "client_reference", "user_upload", "designer_reference"].includes(img?.source_type);
}

function sortImagesForPdf(images: any[], contractMode = false) {
  if (!contractMode) return images;
  return [...images].sort((a, b) => {
    const aPreferred = isPreferredContractImage(a) ? 0 : 1;
    const bPreferred = isPreferredContractImage(b) ? 0 : 1;
    if (aPreferred !== bPreferred) return aPreferred - bPreferred;
    if (a?.source_type === "master_reference") return -1;
    if (b?.source_type === "master_reference") return 1;
    return 0;
  });
}

function buildDocumentPurposeHtml() {
  return `<h2>Назначение документа</h2>
    <p>Настоящее приложение предварительно фиксирует согласованную дизайн-концепцию, исходные вводные, визуальные ориентиры, допущения и бюджетную рамку проекта. Документ является ориентиром для дальнейшей детализации и подлежит уточнению на следующих этапах проектирования, комплектации и сметной проверки.</p>`;
}

function buildInitialInputsHtml(brief: any, rooms: any[], project: any) {
  const parts: string[] = [];
  if (rooms.length > 0) {
    parts.push(`<h3>Помещения</h3><table class="rooms-table">${rooms
      .map((r: any) => {
        const typeLabel = ROOM_TYPES.find((t) => t.value === r.room_type)?.label || r.room_type || "помещение";
        return `<tr><td>${r.name || "Помещение"} <span class="dim">(${typeLabel})</span></td><td class="dim">${r.dimensions_text || "подлежит уточнению"}</td></tr>`;
      })
      .join("")}</table>`);
  }

  const rows = [
    ["Пользователи", brief?.users_of_space],
    ["Сценарии", brief?.scenarios],
    ["Зоны", brief?.zones],
    ["Ограничения", brief?.constraints_practical],
    ["Сроки", brief?.timeline],
    ["Исходные заметки", project?.raw_input],
  ].filter(([, value]) => value);

  if (rows.length > 0) {
    parts.push(`<div class="info-block">${rows
      .map(([label, value]) => `<div class="info-row"><span class="info-label">${label}</span><span>${value}</span></div>`)
      .join("")}</div>`);
  }

  return parts.length > 0 ? `<h2>Исходные вводные</h2>${parts.join("")}` : "";
}

function buildApprovedDesignFormulaHtml(blocks: any[], brief: any) {
  const basis = getConceptBasis(blocks || [], brief);
  const formula = basis.length > 0
    ? basis.slice(0, 3).join(" ")
    : "Дизайн-формула предварительно основана на брифе, выбранных визуальных референсах и ручной проверке дизайнера.";
  return `<h2>Утвержденная дизайн-формула</h2><p>${formula}</p>`;
}

function buildPaletteContractHtml(block: any) {
  if (!block) return "";
  return `<h2>Палитра</h2>
    ${block.caption ? `<p>${block.caption}</p>` : `<p>Роли цветов предварительно фиксируются палитрой ниже и подлежат уточнению при подборе конкретных покрытий.</p>`}
    ${buildColorChipsHtml(block.color_chips || [])}
    <p class="legal-note">Коды RAL/NCS являются ориентиром и подлежат проверке на реальных выкрасах и образцах.</p>`;
}

function buildBlockImagesHtml(block: any, options: { contractMode?: boolean } = {}) {
  const images = sortImagesForPdf((block?.board_images || []).filter((img: any) => img.url), options.contractMode);
  if (images.length === 0) return "";
  const gridClass = images.length === 1 ? "image-grid single" : images.length === 2 ? "image-grid pair" : "image-grid";
  return `<div class="${gridClass}">${images
    .map((img: any) => `<figure class="img-wrap">
      <div class="image-frame"><img src="${img.url}" alt="${img.note || block?.caption || ""}" class="board-image" /></div>
      ${buildImageCaptionHtml(img, block)}
    </figure>`)
    .join("")}</div>`;
}

function buildMaterialsContractHtml(block: any) {
  if (!block) return "";
  return `<h2>Материалы</h2>
    ${block.caption ? `<p>${block.caption}</p>` : `<p>Материалы предварительно фиксируются как направление подбора и подлежат проверке на образцах.</p>`}
    ${buildBlockImagesHtml(block, { contractMode: true })}
    <h3>Допущения и исключения</h3>
    <ul>
      <li>Конкретные артикулы, поставщики и сметные цены подлежат уточнению.</li>
      <li>Практичные аналоги натуральных фактур допускаются только после согласования дизайнером и клиентом.</li>
      <li>Работы подрядчика и инженерные решения не входят в данный раздел.</li>
    </ul>`;
}

function buildLightingContractHtml(block: any) {
  if (!block) return "";
  return `<h2>Освещение</h2>
    ${block.caption ? `<p>${block.caption}</p>` : `<p>Световые сценарии предварительно фиксируют направление подбора и подлежат уточнению светотехническим расчетом.</p>`}
    ${buildLightingZonesHtml(block.lighting_zones || [])}
    ${buildBlockImagesHtml(block, { contractMode: true })}
    <p class="legal-note">Цветовая температура и мощность указаны как предварительный ориентир.</p>`;
}

function buildFurnitureContractHtml(block: any) {
  if (!block) return "";
  return `<h2>Мебель и эргономика</h2>
    ${block.caption ? `<p>${block.caption}</p>` : `<p>Мебельные решения фиксируются предварительно и подлежат уточнению по чистовым размерам.</p>`}
    ${buildBlockImagesHtml(block, { contractMode: true })}
    <p class="legal-note">Габариты и проходы подлежат проверке после обмеров и утверждения планировочного решения.</p>`;
}

function buildContractBoardHtml(blocks: any[], brief: any) {
  const atmosphere = getBlock(blocks, "atmosphere");
  return [
    buildApprovedDesignFormulaHtml(blocks, brief),
    atmosphere ? `<h2>Визуальная атмосфера</h2>${atmosphere.caption ? `<p>${atmosphere.caption}</p>` : ""}${buildBlockImagesHtml(atmosphere, { contractMode: true })}` : "",
    buildPaletteContractHtml(getBlock(blocks, "palette")),
    buildMaterialsContractHtml(getBlock(blocks, "materials")),
    buildLightingContractHtml(getBlock(blocks, "lighting")),
    buildFurnitureContractHtml(getBlock(blocks, "furniture")),
  ].filter(Boolean).join("");
}

function buildContractFixedExceptionsHtml(issues: any[], questions: any[]) {
  const fixedIssues = (issues || []).filter((issue: any) => issue.contract_fixed || issue.contract_note);
  const fixedQuestions = (questions || []).filter((question: any) => question.contract_fixed || question.contract_note);
  if (fixedIssues.length === 0 && fixedQuestions.length === 0) return "";

  return `<h2>Исключения и договорно зафиксированные вопросы</h2>
    ${fixedIssues.map((issue: any) => `<div class="brief-item"><div class="sub-label">${issue.title || "Исключение"}</div><p>${issue.contract_note || issue.suggestion || issue.evidence || "Подлежит уточнению."}</p></div>`).join("")}
    ${fixedQuestions.map((question: any) => `<div class="brief-item"><div class="sub-label">${question.text || "Вопрос"}</div><p>${question.contract_note || question.answer || "Подлежит уточнению."}</p></div>`).join("")}`;
}

function buildContractTitleHtml(projectName: string, date: string, approvalStatus: PdfOptions["approvalStatus"], options: PdfOptions = {}) {
  const version = options.documentVersion || (approvalStatus === "approved" ? "approved v1" : "draft v1");
  const generatedAt = options.generatedAt
    ? new Date(options.generatedAt).toLocaleString("ru-RU")
    : date;
  return `<div class="title-page">
    <h1>Приложение к договору</h1>
    <p class="subtitle">${projectName}</p>
    <div class="info-block">
      <div class="info-row"><span class="info-label">Дата генерации</span><span>${generatedAt}</span></div>
      <div class="info-row"><span class="info-label">Версия документа</span><span>${version}</span></div>
      <div class="info-row"><span class="info-label">Статус</span><span>${approvalStatus === "approved" ? "утвержденная версия" : "предварительная версия"}</span></div>
      <div class="info-row"><span class="info-label">Стороны</span><span>Дизайнер / Клиент</span></div>
    </div>
  </div>`;
}

function buildChangeLogHtml(changes: string[] | undefined) {
  if (!Array.isArray(changes) || changes.length === 0) return "";
  return `<h2>Изменения версии</h2><ul class="basis-list">${changes.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

export function buildContractPdfBodyHtml(data: PdfData, approvalStatus: PdfOptions["approvalStatus"] = "approved", options: PdfOptions = {}) {
  const { project, brief, rooms, issues, questions, blocks } = data;
  const projectName = project?.name || "Проект";
  const date = formatDate();
  const budgetSettings = loadBudgetSettings(project?.id);
  const budgetResult = calculateBudget(
    brief || {},
    rooms || [],
    project || {},
    toBudgetCalculationOptions(budgetSettings)
  );

  return buildContractTitleHtml(projectName, date, approvalStatus, options) +
    buildChangeLogHtml(options.changes) +
    buildDocumentPurposeHtml() +
    buildInitialInputsHtml(brief, rooms || [], project) +
    buildContractBoardHtml(blocks || [], brief) +
    (brief?.budget ? buildBudgetFrameworkHtml(budgetResult) : "") +
    buildContractFixedExceptionsHtml(issues || [], questions || []);
}

function fmtRub(n: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(n))} ₽`;
}

function buildBudgetFrameworkHtml(result: ReturnType<typeof calculateBudget>): string {
  if (!result.canShowInContract || !result.estimateRange) {
    return `<h2>Бюджетная рамка</h2><p>Бюджет клиента зафиксирован, но расчетная бюджетная рамка не выводится в договорное приложение: не хватает площадей помещений для проверяемой методики.</p>`;
  }

  const assumptions = result.assumptions.map((item) => `<li>${item}</li>`).join("");
  const includes = result.includes.map((item) => `<li>${item}</li>`).join("");
  const excludes = result.excludes.map((item) => `<li>${item}</li>`).join("");
  const rates = result.rateRows
    .map((row) => `<tr><td>${row.label}</td><td>${typeof row.value === "number" ? fmtRub(row.value) : row.value}</td></tr>`)
    .join("");
  const missing = result.missingAreaRooms.length > 0
    ? `<p class="warning">Не учтены из-за отсутствия площади: ${result.missingAreaRooms.join(", ")}.</p>`
    : "";

  return `<h2>Бюджетная рамка</h2>
    <div class="info-block">
      <div class="info-row"><span class="info-label">Ориентир по комплектации</span><span>${fmtRub(result.estimateRange.min)} – ${fmtRub(result.estimateRange.max)}</span></div>
      <div class="info-row"><span class="info-label">Сегмент</span><span>${SEGMENT_LABELS[result.segment]}</span></div>
      <div class="info-row"><span class="info-label">Регион / коэффициент</span><span>${result.region} · ×${(result.regionCoefficient * result.manualRateMultiplier).toFixed(2)}</span></div>
      <div class="info-row"><span class="info-label">Версия методики</span><span>${result.methodologyVersion} · ${result.methodologyDate}</span></div>
    </div>
    <table class="rooms-table">${rates}</table>
    <h3>Допущения</h3><ul>${assumptions}</ul>
    <h3>Что входит</h3><ul>${includes}</ul>
    <h3>Что не входит</h3><ul>${excludes}</ul>
    ${missing}`;
}

export function generateFullPDF(data: PdfData, options: PdfOptions = {}) {
  const { project, brief, rooms, issues, questions, blocks } = data;
  const variant = options.variant === "full" ? "working" : options.variant || "working";
  const approvalStatus = options.approvalStatus || "draft";
  const isContract = variant === "contract";
  const includeBoard = (variant === "working" || variant === "contract") && (blocks || []).length > 0;
  const budgetSettings = loadBudgetSettings(project?.id);
  const budgetResult = calculateBudget(
    brief || {},
    rooms || [],
    project || {},
    toBudgetCalculationOptions(budgetSettings)
  );

  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;

  const date = formatDate();
  const fileDate = formatFilenameDate();
  const projectName = project?.name || "Проект";

  const docTitle = variant === "brief"
    ? `${projectName}_бриф_${fileDate}`
    : isContract
      ? `${projectName}_приложение_к_договору_${fileDate}`
      : `${projectName}_рабочий_отчет_${fileDate}`;

  // ── Заголовок ─────────────────────────────────────────────────────────────
  const titleHtml = isContract
    ? buildContractTitleHtml(projectName, date, approvalStatus, options)
    : `<div class="title-page">
      <p class="kicker">${variant === "brief" ? "Рабочий бриф" : "Рабочий отчет"}</p>
      <h1>${projectName}</h1>
      <p class="subtitle">${date}</p>
      <div class="info-block title-meta">
        <div class="info-row"><span class="info-label">Версия</span><span>${options.documentVersion || "draft v1"}</span></div>
        <div class="info-row"><span class="info-label">Статус</span><span>${approvalStatus === "approved" ? "утвержденная версия" : "требует проверки дизайнера"}</span></div>
      </div>
    </div>`;

  // ── Критерии успеха ────────────────────────────────────────────────────────
  const successCriteriaHtml = brief?.success_criteria
    ? `<h2>Критерии успеха</h2><p>${brief.success_criteria}</p>`
    : "";

  // ── Данные проекта ─────────────────────────────────────────────────────────
  const projectParts: string[] = [];
  if (brief?.budget && (!isContract || !budgetResult.canShowInContract))
    projectParts.push(`<div class="info-row"><span class="info-label">Бюджет</span><span>${brief.budget}</span></div>`);
  if (brief?.timeline)
    projectParts.push(`<div class="info-row"><span class="info-label">Сроки</span><span>${brief.timeline}</span></div>`);
  if (brief?.constraints_practical)
    projectParts.push(`<div class="info-row"><span class="info-label">Ограничения и табу</span><span>${brief.constraints_practical}</span></div>`);
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
  const DETAIL_KEYS = ["success_criteria", "budget", "timeline", "constraints_practical"];
  const briefSections = BRIEF_SECTIONS.filter((s) => !DETAIL_KEYS.includes(s.key));
  const briefHtml = `<h2>Бриф</h2>` + briefSections
    .map(
      ({ key, label }) =>
        `<div class="brief-item"><div class="sub-label">${label}</div><p>${(brief as any)?.[key] || "не указано"}</p></div>`
    )
    .join("");

  // ── Противоречия ──────────────────────────────────────────────────────────
  const contradictions = (issues || []).filter((i: any) => i.type === "contradiction");
  const contradictionsHtml = !isContract && contradictions.length > 0
    ? `<h2>Противоречия</h2>` +
      contradictions
        .map(
          (issue: any) =>
            `<div class="issue"><div class="issue-title">${issue.title}</div>${issue.evidence ? `<p class="evidence">«${issue.evidence}»</p>` : ""}${issue.suggestion ? `<p class="suggestion">${issue.suggestion}</p>` : ""}</div>`
        )
        .join("")
    : "";

  // ── Вопросы ───────────────────────────────────────────────────────────────
  const questionsHtml = !isContract && (questions || []).length > 0
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
  const conceptBasisHtml = isContract ? buildConceptBasisHtml(getConceptBasis(blocks || [], brief)) : "";
  const budgetFrameworkHtml = isContract && brief?.budget ? buildBudgetFrameworkHtml(budgetResult) : "";
  const boardHtml =
    includeBoard && !isContract
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

            return `<div class="board-block">
              <h3>${label}</h3>
              ${block.caption ? `<p class="block-caption">${block.caption}</p>` : ""}
              ${
                getBlockRationale(block, brief).length > 0
                  ? `<div class="rationale"><div class="rationale-title">Почему это здесь</div><ul>${getBlockRationale(block, brief)
                      .map((reason) => `<li>${reason}</li>`)
                      .join("")}</ul></div>`
                  : ""
              }
              ${chipsHtml}
              ${zonesHtml}
              ${block.block_type !== "palette" ? buildBlockImagesHtml(block) : ""}
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
    isContract && approvalStatus === "approved"
      ? `Утверждённая версия · Приложение к договору · ${options.documentVersion || "approved v1"} · ${date}`
      : `Рабочий документ, требует проверки дизайнера · ${options.documentVersion || "draft v1"} · ${date}`;
  const footerHtml = `<p class="footer">${footerText}</p>`;

  // ── CSS ───────────────────────────────────────────────────────────────────
  const css = `
@page{size:A4;margin:18mm 16mm 20mm;}
*{box-sizing:border-box;}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1a1a1a;font-size:15px;line-height:1.6;background:#fff;}
h1{font-size:34px;font-weight:300;line-height:1.12;margin:0 0 10px;}
.kicker{font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#9a7840;margin:0 0 18px;}
.subtitle{font-size:14px;color:#777;margin:0 0 34px;}
h2{font-size:18px;font-weight:400;margin:44px 0 16px;border-top:1px solid #e0e0e0;padding-top:22px;break-after:avoid;page-break-after:avoid;}
h3{font-size:15px;font-weight:500;margin:0 0 6px;}
p{margin:0 0 8px;color:#444;}
.sub-label{font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin:0 0 6px;}
.info-block{margin-bottom:8px;break-inside:avoid;page-break-inside:avoid;}
.info-row{display:flex;gap:16px;padding:6px 0;border-bottom:1px solid #f0f0f0;}
.info-label{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888;min-width:160px;}
.rooms-table{width:100%;border-collapse:collapse;margin-bottom:8px;}
.rooms-table td{padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:14px;}
.rooms-table tr,.zones-table tr{break-inside:avoid;page-break-inside:avoid;}
.dim{color:#888;}
.brief-item{padding:16px 0;border-bottom:1px solid #f0f0f0;break-inside:avoid;page-break-inside:avoid;}
.issue{margin-bottom:16px;padding-left:16px;border-left:3px solid #c44;break-inside:avoid;page-break-inside:avoid;}
.issue-title{font-size:15px;font-weight:500;color:#c44;}
.evidence{font-size:13px;color:#888;font-style:italic;margin:4px 0;}
.suggestion{font-size:14px;color:#7a5500;margin:4px 0;}
.warning{font-size:13px;color:#9a6700;margin:8px 0;}
.legal-note{font-size:13px;color:#777;font-style:italic;margin-top:8px;}
.title-page{min-height:82vh;display:flex;flex-direction:column;justify-content:center;margin-bottom:48px;break-after:page;page-break-after:always;}
.title-meta{max-width:520px;margin-top:18px;}
.question{margin-bottom:12px;padding:8px 0;border-bottom:1px solid #f0f0f0;break-inside:avoid;page-break-inside:avoid;}
.priority{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;padding:2px 8px;border:1px solid #bbb;margin-right:10px;}
.answer{font-size:14px;color:#7a5500;margin:4px 0 0;}
.unlocks{font-size:12px;color:#888;margin:2px 0 0;}
.board-block{margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #f0f0f0;break-inside:avoid;page-break-inside:avoid;}
.block-caption{color:#555;font-size:14px;margin:6px 0 12px;}
.basis-list{margin:0 0 8px 18px;padding:0;color:#444;}
.basis-list li{margin-bottom:6px;}
.rationale{border-left:2px solid #d8c7a7;padding-left:12px;margin:10px 0 14px;break-inside:avoid;page-break-inside:avoid;}
.rationale-title{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#777;margin-bottom:4px;}
.rationale ul{margin:0 0 0 16px;padding:0;color:#666;font-size:13px;}
.rationale li{margin-bottom:3px;}
.image-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0 4px;break-inside:avoid;page-break-inside:avoid;}
.image-grid.single{grid-template-columns:minmax(0,1fr);max-width:520px;}
.image-grid.pair{grid-template-columns:repeat(2,minmax(0,1fr));}
.img-wrap{margin:0;break-inside:avoid;page-break-inside:avoid;}
.image-frame{height:142px;background:#f7f5f0;border:1px solid #ece7dc;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.image-grid.single .image-frame{height:260px;}
.image-grid.pair .image-frame{height:190px;}
.board-image{width:100%;height:100%;object-fit:contain;display:block;}
.image-note{font-size:11px;color:#8a6f43;margin-top:6px;line-height:1.35;break-before:avoid;page-break-before:avoid;}
.image-note span{display:block;}
.chip-grid{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0 16px;}
.chip{width:96px;break-inside:avoid;page-break-inside:avoid;}
.chip-swatch{width:96px;height:72px;border-radius:3px;}
.chip-name{font-size:12px;font-weight:500;margin-top:5px;color:#1a1a1a;}
.chip-ral{font-size:11px;font-family:monospace;color:#888;}
.chip-hex{font-size:10px;font-family:monospace;color:#bbb;}
.zones-table{width:100%;border-collapse:collapse;font-size:13px;margin:12px 0;}
.zones-table th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888;padding:4px 8px 8px 0;border-bottom:1px solid #ddd;}
.zones-table td{padding:7px 8px 7px 0;border-bottom:1px solid #f0f0f0;}
.zone-name{font-weight:500;}
.zone-kelvin{font-family:monospace;color:#888;}
.approval-block{margin-top:48px;break-before:page;page-break-before:always;}
.approval-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:24px;}
.approval-role{font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-bottom:56px;}
.approval-line{border-bottom:1px solid #555;margin-bottom:6px;}
.approval-hint{font-size:11px;color:#bbb;}
.footer{text-align:center;font-size:12px;color:#aaa;margin-top:56px;font-style:italic;}
@media print{
  body{max-width:none;margin:0;padding:0;font-size:13px;}
  h2{margin-top:30px;}
  h2:nth-of-type(n+4){break-before:page;page-break-before:always;}
  .title-page{min-height:245mm;margin:0;}
  .image-frame{height:38mm;}
  .image-grid.single .image-frame{height:76mm;}
  .image-grid.pair .image-frame{height:54mm;}
}`;

  const bodyHtml = isContract
    ? buildContractPdfBodyHtml(data, approvalStatus, options) +
      approvalHtml +
      footerHtml
    : titleHtml +
      buildChangeLogHtml(options.changes) +
      successCriteriaHtml +
      projectInfoHtml +
      roomsHtml +
      budgetFrameworkHtml +
      briefHtml +
      contradictionsHtml +
      questionsHtml +
      conceptBasisHtml +
      boardHtml +
      approvalHtml +
      footerHtml;

  printWindow.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docTitle}</title><style>${css}</style></head><body>${bodyHtml}</body></html>`
  );
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 400);
  return true;
}
