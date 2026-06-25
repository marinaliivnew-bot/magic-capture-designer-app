import { BOARD_BLOCK_TYPES } from "./constants";
import { getReferenceCoverage, getStyleConsistency } from "./concept-rationale";
import { calculateBudget } from "./budget-calculator";

export type PreflightSeverity = "P0" | "P1" | "P2";
export type PreflightStatus = "pass" | "warning" | "fail";

export interface PreflightIssue {
  id: string;
  severity: PreflightSeverity;
  title: string;
  detail: string;
  blockType?: string;
  targetPath?: string;
  canOverride: boolean;
}

export interface PreflightResult {
  status: PreflightStatus;
  issues: PreflightIssue[];
  blockingIssues: PreflightIssue[];
  overrideableIssues: PreflightIssue[];
}

interface PreflightData {
  project?: any;
  brief?: any;
  questions?: any[];
  blocks?: any[];
  rooms?: any[];
}

const REQUIRED_BLOCK_TYPES = ["atmosphere", "palette", "materials", "furniture", "lighting"];
const IMAGE_REQUIRED_BLOCK_TYPES = ["atmosphere", "materials", "furniture", "lighting"];
const MIN_IMAGES_BY_BLOCK: Record<string, number> = {
  atmosphere: 2,
  materials: 2,
  furniture: 1,
  lighting: 2,
};

const PREFERRED_CONTRACT_IMAGE_SOURCES = new Set([
  "master_reference",
  "client_reference",
  "designer_reference",
  "user_upload",
]);

const AUTO_OR_STOCK_IMAGE_SOURCES = new Set([
  "unsplash_auto",
  "stock_reference",
  "generated_reference",
]);

const PLACEHOLDER_PATTERNS = [
  "placeholder",
  "placehold.co",
  "via.placeholder",
  "dummyimage",
  "loremflickr",
  "example.com",
  "data:image/svg",
];

const BUDGET_METHODOLOGY_KEYS = [
  "budget_methodology",
  "budget_assumptions",
  "budget_includes",
  "budget_excludes",
];

function getBlockLabel(type: string) {
  return BOARD_BLOCK_TYPES.find((block) => block.type === type)?.label || type;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlaceholderUrl(url: string) {
  const normalized = url.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function hasValidImageUrl(image: any) {
  const url = text(image?.url);
  const loadStatus = text(image?.load_status || image?.loadStatus || image?.status);
  return url.length > 0 && !isPlaceholderUrl(url) && loadStatus !== "failed" && loadStatus !== "missing";
}

function imageSourceType(image: any) {
  return text(image?.source_type);
}

function hasDecisionTrace(block: any) {
  if (text(block?.source_type) || text(block?.source_url) || text(block?.evidence)) return true;
  if (Array.isArray(block?.sources) && block.sources.length > 0) return true;
  if (Array.isArray(block?.decision_sources) && block.decision_sources.length > 0) return true;
  if (Array.isArray(block?.board_images)) {
    return block.board_images.some(
      (img: any) =>
        text(img?.source_type) ||
        text(img?.source_url) ||
        text(img?.attribution) ||
        text(img?.note)
    );
  }
  return false;
}

function hasBudgetMethodology(project: any, brief: any, rooms: any[] = []) {
  const calculated = calculateBudget(brief || {}, rooms, project || {});
  if (calculated.canShowInContract) return true;
  return BUDGET_METHODOLOGY_KEYS.some((key) => text(brief?.[key]) || text(project?.[key]));
}

function issue(params: PreflightIssue): PreflightIssue {
  return params;
}

export function runExportPreflight(data: PreflightData): PreflightResult {
  const { project, brief, questions = [], blocks = [], rooms = [] } = data;
  const issues: PreflightIssue[] = [];
  const blocksByType = new Map(blocks.map((block: any) => [block.block_type, block]));

  for (const blockType of REQUIRED_BLOCK_TYPES) {
    const block = blocksByType.get(blockType);
    if (!block) {
      issues.push(
        issue({
          id: `missing-block-${blockType}`,
          severity: "P0",
          title: `Нет обязательного блока: ${getBlockLabel(blockType)}`,
          detail: "Договорный экспорт требует полный набор блоков concept board.",
          blockType,
          targetPath: `/board#block-${blockType}`,
          canOverride: true,
        })
      );
      continue;
    }

    if (!text(block.caption) && blockType !== "palette") {
      issues.push(
        issue({
          id: `missing-caption-${blockType}`,
          severity: "P1",
          title: `Нет описания решения: ${getBlockLabel(blockType)}`,
          detail: "Добавьте короткое дизайнерское обоснование, чтобы решение не выглядело случайным.",
          blockType,
          targetPath: `/board#block-${blockType}`,
          canOverride: true,
        })
      );
    }

    if (!hasDecisionTrace(block)) {
      issues.push(
        issue({
          id: `missing-trace-${blockType}`,
          severity: "P1",
          title: `Нет трассировки к источникам: ${getBlockLabel(blockType)}`,
          detail: "Укажите связь решения с брифом, референсом, ответом клиента или ручным решением дизайнера.",
          blockType,
          targetPath: `/board#block-${blockType}`,
          canOverride: true,
        })
      );
    }

    if (blockType === "palette") {
      if (!Array.isArray(block.color_chips) || block.color_chips.length === 0) {
        issues.push(
          issue({
            id: "missing-palette-chips",
            severity: "P0",
            title: "Палитра не заполнена",
            detail: "В блоке палитры нет RAL/NCS-чипов или цветовых ролей.",
            blockType,
            targetPath: `/board#block-${blockType}`,
            canOverride: true,
          })
        );
      }
      continue;
    }

    if (IMAGE_REQUIRED_BLOCK_TYPES.includes(blockType)) {
      const images = Array.isArray(block.board_images) ? block.board_images : [];
      const validImages = images.filter(hasValidImageUrl);
      const requiredCount = MIN_IMAGES_BY_BLOCK[blockType] || 1;

      images.forEach((img: any, index: number) => {
        const url = text(img?.url);
        if (!url) {
          issues.push(
            issue({
              id: `empty-image-${blockType}-${index + 1}`,
              severity: "P0",
              title: `Пустое изображение: ${getBlockLabel(blockType)}, референс ${index + 1}`,
              detail: "Заполните URL изображения или удалите пустой слот перед экспортом.",
              blockType,
              targetPath: `/board#block-${blockType}`,
              canOverride: true,
            })
          );
        } else if (isPlaceholderUrl(url)) {
          issues.push(
            issue({
              id: `placeholder-image-${blockType}-${index + 1}`,
              severity: "P0",
              title: `Placeholder вместо изображения: ${getBlockLabel(blockType)}, референс ${index + 1}`,
              detail: "Замените placeholder на реальный визуальный референс.",
              blockType,
              targetPath: `/board#block-${blockType}`,
              canOverride: true,
            })
          );
        } else if (["failed", "missing"].includes(text(img?.load_status || img?.loadStatus || img?.status))) {
          issues.push(
            issue({
              id: `unavailable-image-${blockType}-${index + 1}`,
              severity: "P0",
              title: `Изображение недоступно: ${getBlockLabel(blockType)}, референс ${index + 1}`,
              detail: "Изображение помечено как failed/missing после проверки загрузки. Замените URL перед экспортом договорного PDF.",
              blockType,
              targetPath: `/board#block-${blockType}`,
              canOverride: true,
            })
          );
        }
      });

      if (validImages.length < requiredCount) {
        issues.push(
          issue({
            id: `too-few-images-${blockType}`,
            severity: "P0",
            title: `Недостаточно референсов: ${getBlockLabel(blockType)}`,
            detail: `Нужно минимум ${requiredCount}, сейчас валидных изображений: ${validImages.length}.`,
            blockType,
            targetPath: `/board#block-${blockType}`,
            canOverride: true,
          })
        );
      }

      const preferredImages = validImages.filter((img: any) =>
        PREFERRED_CONTRACT_IMAGE_SOURCES.has(imageSourceType(img))
      );
      const autoOrStockWithoutContext = validImages.filter((img: any) =>
        AUTO_OR_STOCK_IMAGE_SOURCES.has(imageSourceType(img)) &&
        !text(img?.note) &&
        !text(img?.source_url) &&
        !text(img?.attribution)
      );

      if (validImages.length > 0 && preferredImages.length === 0) {
        issues.push(
          issue({
            id: `no-approved-image-source-${blockType}`,
            severity: "P1",
            title: `Нет утвержденного источника изображения: ${getBlockLabel(blockType)}`,
            detail: "Для договорного PDF предпочтительны клиентские, ручные, дизайнерские или мастер-референсы. Пометьте хотя бы одно изображение блока как утвержденный источник.",
            blockType,
            targetPath: `/board#block-${blockType}`,
            canOverride: true,
          })
        );
      }

      autoOrStockWithoutContext.forEach((img: any, index: number) => {
        issues.push(
          issue({
            id: `unexplained-auto-image-${blockType}-${index + 1}`,
            severity: "P1",
            title: `Авто/stock-изображение без связи с концепцией: ${getBlockLabel(blockType)}`,
            detail: "Добавьте заметку, attribution/source URL или замените изображение на клиентский, ручной или дизайнерский референс.",
            blockType,
            targetPath: `/board#block-${blockType}`,
            canOverride: true,
          })
        );
      });
    }
  }

  const unresolved = questions.filter(
    (q: any) => ["critical", "important"].includes(q.priority) && !text(q.answer)
  );
  unresolved.forEach((q: any, index: number) => {
    issues.push(
      issue({
        id: `unresolved-question-${q.id || index}`,
        severity: "P0",
        title: "Не закрыт critical/important вопрос",
        detail: q.text || "Перед договорным экспортом нужен ответ или решение дизайнера.",
        targetPath: "/questions",
        canOverride: true,
      })
    );
  });

  if (text(brief?.budget) && !hasBudgetMethodology(project, brief, rooms)) {
    issues.push(
      issue({
        id: "missing-budget-methodology",
        severity: "P1",
        title: "Бюджет указан без методики",
        detail: "Если бюджет попадает в документ, добавьте методику расчета, допущения или явно подтвердите экспорт с риском.",
        targetPath: "/brief",
        canOverride: true,
      })
    );
  }

  const referenceCoverage = getReferenceCoverage(brief, blocks);
  if (referenceCoverage.signalCount > 0 && referenceCoverage.ratio < 0.5) {
    issues.push(
      issue({
        id: "low-client-reference-coverage",
        severity: "P1",
        title: "Клиентские референсы слабо отражены в концепции",
        detail: `Учтено ${referenceCoverage.usedCount} из ${referenceCoverage.signalCount} сигналов. Проверьте матрицу соответствия на concept board.`,
        targetPath: "/board#reference-match-matrix",
        canOverride: true,
      })
    );
  }

  const styleConsistency = getStyleConsistency(brief, blocks);
  styleConsistency.conflicts.forEach((conflict, index) => {
    issues.push(
      issue({
        id: `style-conflict-${conflict.blockType}-${index}`,
        severity: "P1",
        title: `Стилистический конфликт: ${getBlockLabel(conflict.blockType)}`,
        detail: `${conflict.reason} Проверьте стилевую формулу и мастер-референс на concept board.`,
        blockType: conflict.blockType,
        targetPath: `/board#block-${conflict.blockType}`,
        canOverride: true,
      })
    );
  });

  const blockingIssues = issues.filter((item) => item.severity === "P0" || item.severity === "P1");
  const overrideableIssues = blockingIssues.filter((item) => item.canOverride);

  return {
    status: blockingIssues.length > 0 ? "fail" : issues.length > 0 ? "warning" : "pass",
    issues,
    blockingIssues,
    overrideableIssues,
  };
}
