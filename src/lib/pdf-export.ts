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
}

function formatDate() {
  return new Date().toLocaleDateString("ru-RU");
}

function formatFilenameDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function generateFullPDF(data: PdfData, options: PdfOptions = {}) {
  const { project, brief, rooms, issues, questions, blocks } = data;
  const variant = options.variant || "full";
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;

  const date = formatDate();
  const fileDate = formatFilenameDate();
  const projectName = project?.name || "Проект";
  const constraints = (project?.constraints as Record<string, string>) || {};

  const docTitle = variant === "brief"
    ? `${projectName}_бриф_${fileDate}`
    : `${projectName}_концепт_${fileDate}`;

  // Title
  const titleHtml = `<h1 style="font-size:32px;font-weight:300;margin:0 0 4px;">${projectName}</h1>
    <p style="font-size:13px;color:#888;margin-bottom:32px;">${date}</p>`;

  // Project info
  const infoParts: string[] = [];
  if (constraints.budget) infoParts.push(`<div><strong>Бюджет:</strong> ${constraints.budget}</div>`);
  if (constraints.timeline) infoParts.push(`<div><strong>Сроки:</strong> ${constraints.timeline}</div>`);
  if (constraints.taboos) infoParts.push(`<div><strong>Табу:</strong> ${constraints.taboos}</div>`);
  if (constraints.must_haves) infoParts.push(`<div><strong>Must-have:</strong> ${constraints.must_haves}</div>`);
  if (constraints.nice_to_haves) infoParts.push(`<div><strong>Nice-to-have:</strong> ${constraints.nice_to_haves}</div>`);
  if (project?.raw_input) infoParts.push(`<div style="margin-top:8px;"><strong>Заметки:</strong><p style="margin:4px 0 0;">${project.raw_input}</p></div>`);
  if (project?.rooms_description) infoParts.push(`<div><strong>Описание помещений:</strong><p style="margin:4px 0 0;">${project.rooms_description}</p></div>`);

  const projectInfoHtml = infoParts.length > 0
    ? `<h2>Данные проекта</h2><div class="info-block">${infoParts.join("")}</div>`
    : "";

  // Rooms
  const roomsHtml = rooms.length > 0
    ? `<h3 class="sub-label">Помещения</h3><ul>${rooms.map((r: any) => {
        const typeLabel = ROOM_TYPES.find(t => t.value === r.room_type)?.label || r.room_type;
        let line = `${r.name} (${typeLabel})`;
        if (r.dimensions_text) line += ` — ${r.dimensions_text}`;
        return `<li>${line}</li>`;
      }).join("")}</ul>`
    : "";

  // Brief
  const briefHtml = BRIEF_SECTIONS.map(
    ({ key, label }) =>
      `<div class="brief-item"><h3 class="sub-label">${label}</h3><p>${(brief as any)?.[key] || "не указано"}</p></div>`
  ).join("");

  // Contradictions
  const contradictions = (issues || []).filter((i: any) => i.type === "contradiction");
  const contradictionsHtml = contradictions.length > 0
    ? `<h2>Противоречия</h2>` + contradictions.map(
        (issue: any) =>
          `<div class="issue"><h3 class="issue-title">${issue.title}</h3>${issue.evidence ? `<p class="evidence">«${issue.evidence}»</p>` : ""}${issue.suggestion ? `<p class="suggestion">${issue.suggestion}</p>` : ""}</div>`
      ).join("")
    : "";

  // Questions
  const questionsHtml = (questions || []).length > 0
    ? `<h2>Уточняющие вопросы</h2>` + questions.map(
        (q: any) => {
          const priorityLabel = PRIORITY_CONFIG[q.priority as keyof typeof PRIORITY_CONFIG]?.label || q.priority;
          return `<div class="question"><span class="priority">${priorityLabel}</span> ${q.text}${q.answer ? `<p class="answer">Ответ: ${q.answer}</p>` : ""}${q.unlocks ? `<p class="unlocks">Разблокирует: ${q.unlocks}</p>` : ""}</div>`;
        }
      ).join("")
    : "";

  // Board (only in full variant)
  const boardHtml = variant === "full" && (blocks || []).length > 0
    ? `<h2>Концепт-борд</h2>` + blocks.map((block: any) => {
        const label = BOARD_BLOCK_TYPES.find(b => b.type === block.block_type)?.label || block.block_type;
        const images = (block.board_images || [])
          .filter((img: any) => img.url)
          .map((img: any) => `<li><a href="${img.url}" style="color:#A07850;">${img.note || img.url}</a></li>`)
          .join("");
        return `<div class="board-block"><h3>${label}</h3>${block.caption ? `<p>${block.caption}</p>` : ""}${images ? `<ul class="image-links">${images}</ul>` : ""}</div>`;
      }).join("")
    : "";

  // Footer
  const footerHtml = `<p class="footer">Draft concept, requires designer review · ${date}</p>`;

  printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docTitle}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:700px;margin:40px auto;padding:0 24px;color:#222;font-size:15px;line-height:1.6;}
h1{font-size:32px;font-weight:300;margin-bottom:4px;}
h2{font-size:20px;margin:40px 0 16px;border-top:1px solid #ddd;padding-top:24px;}
h3{font-size:16px;margin:0 0 4px;}
.sub-label{font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin:0 0 6px;}
.info-block{margin-bottom:24px;}
.info-block div{margin-bottom:4px;}
.info-block strong{font-size:13px;color:#888;}
ul{padding-left:20px;}
li{line-height:1.8;}
.brief-item{margin-bottom:20px;}
.brief-item p{margin:0;color:#333;}
.issue{margin-bottom:16px;padding-left:16px;border-left:3px solid #c44;}
.issue-title{color:#c44;}
.evidence{font-size:13px;color:#888;font-style:italic;margin:4px 0;}
.suggestion{font-size:14px;color:#8a6d3b;margin:4px 0;}
.question{margin-bottom:12px;}
.priority{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;padding:2px 8px;border:1px solid #999;border-radius:3px;margin-right:8px;}
.answer{font-size:14px;color:#8a6d3b;margin:4px 0 0;}
.unlocks{font-size:13px;color:#888;margin:2px 0 0;}
.board-block{margin-bottom:20px;}
.board-block p{color:#333;}
.image-links{margin-top:4px;}
.image-links li{font-size:13px;line-height:1.6;}
.footer{text-align:center;font-size:12px;color:#aaa;margin-top:48px;font-style:italic;}
@media print{body{margin:20px auto;}}
</style></head><body>
${titleHtml}${projectInfoHtml}${roomsHtml}<h2>Бриф</h2>${briefHtml}${contradictionsHtml}${questionsHtml}${boardHtml}${footerHtml}
</body></html>`);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 400);
  return true;
}
