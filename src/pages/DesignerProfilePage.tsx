// DesignerProfilePage - v2 with name field and AI analysis
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Loader2, Save, ArrowLeft, Upload, FileText, Trash2, Sparkles } from "lucide-react";
import { getDesignerProfile, upsertDesignerProfile, type DesignerProfile } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";

// Slider configurations for visual language
const VISUAL_SLIDERS = [
  { key: "temperature", left: "Холодно", right: "Тепло" },
  { key: "strictness", left: "Строго", right: "Свободно" },
  { key: "texture", left: "Просто", right: "Фактурно" },
  { key: "color", left: "Монохром", right: "Цветно" },
  { key: "style", left: "Классика", right: "Авангард" },
];

interface UploadedFile {
  path: string;
  name: string;
  url: string;
}

interface ExtractedSource {
  file: UploadedFile;
  source: "Портфолио" | "База знаний";
  text: string;
  truncated?: boolean;
  originalCharCount?: number;
  includedCharCount: number;
  pageCount?: number | null;
  fileSizeBytes?: number | null;
  note?: string;
}

interface AnalysisDebug {
  portfolioImagesTotal: number;
  portfolioImagesSent: number;
  pdfFilesSentToVision: number;
  portfolioDocumentsTotal: number;
  knowledgeFilesTotal: number;
  promptTextBudget: number;
  promptTextIncluded: number;
  validation?: {
    sentenceCount: number;
    actionCount: number;
    retried: boolean;
    qualityIssues: string[];
  };
  warnings: string[];
  sources: Array<{
    name: string;
    source: ExtractedSource["source"];
    note: string;
    originalCharCount: number;
    includedCharCount: number;
    pageCount?: number | null;
    fileSizeBytes?: number | null;
    truncated: boolean;
  }>;
}

const EXTRACTED_SOURCE_TEXT_BUDGET = 20_000;
const MAX_PDF_PAGES_FOR_FILE_INPUT = 80;
const MAX_PDF_BYTES_FOR_FILE_INPUT = 10 * 1024 * 1024;


const DesignerProfilePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sessionId] = useState(getSessionId());
  const [dragActive, setDragActive] = useState(false);

  const [profile, setProfile] = useState<DesignerProfile>({
    session_id: sessionId,
    designer_name: "",
    style_description: "",
    style_refs: [],
    hard_constraints: {},
    ergonomics_rules: Object.fromEntries(VISUAL_SLIDERS.map(s => [s.key, 5])),
    custom_ergonomics_text: "",
  });

  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisDebug, setAnalysisDebug] = useState<AnalysisDebug | null>(null);

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [knowledgeFiles, setKnowledgeFiles] = useState<UploadedFile[]>([]);
  const [kbDragActive, setKbDragActive] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [sessionId]);

  // Load all files from storage bucket for this session
  const loadFilesFromStorage = async () => {
    try {
      const { data: files, error } = await supabase.storage
        .from("designer-portfolio")
        .list(sessionId);
      
      if (error) {
        console.error("[loadFiles] Error listing files:", error);
        return;
      }
      
      if (!files || files.length === 0) {
        setUploadedFiles([]);
        setKnowledgeFiles([]);
        return;
      }
      
      const portfolioFiles: UploadedFile[] = [];
      const kbFiles: UploadedFile[] = [];
      
      for (const file of files) {
        const path = `${sessionId}/${file.name}`;
        const { data: urlData } = supabase.storage.from("designer-portfolio").getPublicUrl(path);
        
        const uploadedFile: UploadedFile = {
          path,
          name: file.name,
          url: urlData.publicUrl,
        };
        
        // Categorize by prefix
        if (file.name.startsWith("portfolio_")) {
          portfolioFiles.push(uploadedFile);
        } else if (file.name.startsWith("kb_")) {
          kbFiles.push(uploadedFile);
        } else {
          // Fallback: categorize by extension
          const ext = file.name.toLowerCase();
          if (ext.endsWith('.pdf') || ext.endsWith('.docx') || ext.endsWith('.txt')) {
            kbFiles.push(uploadedFile);
          } else {
            portfolioFiles.push(uploadedFile);
          }
        }
      }
      
      setUploadedFiles(portfolioFiles);
      setKnowledgeFiles(kbFiles);
    } catch (err) {
      console.error("[loadFiles] Error:", err);
    }
  };

  const loadProfile = async () => {
    console.log("[loadProfile] Starting with sessionId:", sessionId);
    try {
      const data = await getDesignerProfile(sessionId);
      console.log("[loadProfile] Received data:", data);
      
      if (data) {
        // Merge with existing profile to preserve any defaults not in DB
        setProfile((prev) => ({
          ...prev,
          ...data,
          session_id: sessionId,
          // Ensure arrays are arrays
          style_refs: Array.isArray(data.style_refs) ? data.style_refs : [],
          hard_constraints: data.hard_constraints || {},
          ergonomics_rules: data.ergonomics_rules || prev.ergonomics_rules,
        }));
        
        // Load saved AI analysis
        if (data.ai_analysis) {
          setAnalysisResult(data.ai_analysis);
        }
        
        console.log("[loadProfile] Profile loaded:", data.designer_name);
      } else {
        console.log("[loadProfile] No data found for sessionId:", sessionId);
      }
      
      // Load files from storage
      await loadFilesFromStorage();
      
    } catch (e) {
      console.error("[loadProfile] Error:", e);
      toast.error("Ошибка загрузки профиля");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Store only files that are actually available to analysis.
      const portfolioPaths = uploadedFiles.map(f => f.path);
      const kbPaths = knowledgeFiles.map(f => f.path);
      await upsertDesignerProfile({
        ...profile,
        style_refs: [...portfolioPaths, ...kbPaths],
      });
      toast.success("Профиль сохранен");
    } catch (e) {
      toast.error("Ошибка сохранения");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const updateSlider = (key: string, value: number[]) => {
    setProfile((prev) => ({
      ...prev,
      ergonomics_rules: { ...prev.ergonomics_rules, [key]: value[0] },
    }));
  };

  // Normalize filename: transliterate Cyrillic, remove spaces and special chars
  const sanitizeFilename = useCallback((name: string): string => {
    const translit: Record<string, string> = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
      'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
      'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
      'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
      'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
      'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '',
      'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
    };
    const normalized = name
      .split('')
      .map(char => translit[char] || char)
      .join('')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '');
    return normalized || 'file'; // fallback if everything stripped
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const uploadFiles = async (files: File[]) => {
    const validTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    const validFiles = files.filter(f => validTypes.includes(f.type));

    if (validFiles.length === 0) {
      toast.error("Поддерживаются только JPG, PNG и PDF");
      return;
    }

    setUploading(true);
    const newFiles: UploadedFile[] = [];

    for (const file of validFiles) {
      const safeName = sanitizeFilename(file.name);
      const filePath = `${sessionId}/portfolio_${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from("designer-portfolio")
        .upload(filePath, file, { upsert: true });

      if (error) {
        toast.error(`Ошибка загрузки ${file.name}`);
        console.error(error);
      } else {
        const { data } = supabase.storage.from("designer-portfolio").getPublicUrl(filePath);
        newFiles.push({ path: filePath, name: file.name, url: data.publicUrl });
      }
    }

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    setUploading(false);
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  }, [sessionId]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await uploadFiles(files);
  };

  const removeFile = async (file: UploadedFile) => {
    const { error } = await supabase.storage.from("designer-portfolio").remove([file.path]);
    if (error) {
      toast.error("Ошибка удаления файла");
      return;
    }
    setUploadedFiles((prev) => prev.filter(f => f.path !== file.path));
    toast.success("Файл удалён");
  };

  // Knowledge base files upload (PDF, DOCX, TXT)
  const [kbUploading, setKbUploading] = useState(false);

  const handleKbDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setKbDragActive(true);
    } else if (e.type === "dragleave") {
      setKbDragActive(false);
    }
  }, []);

  const uploadKnowledgeFiles = async (files: File[]) => {
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/markdown",
    ];
    const validFiles = files.filter(f => validTypes.includes(f.type));

    if (validFiles.length === 0) {
      toast.error("Поддерживаются только PDF, DOCX и TXT");
      return;
    }

    // Check file size (20 MB max)
    const oversized = validFiles.filter(f => f.size > 20 * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error("Файлы превышают 20 МБ");
      return;
    }

    setKbUploading(true);
    const newFiles: UploadedFile[] = [];

    for (const file of validFiles) {
      const safeName = sanitizeFilename(file.name);
      const filePath = `${sessionId}/kb_${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from("designer-portfolio")
        .upload(filePath, file, { upsert: true });

      if (error) {
        toast.error(`Ошибка загрузки ${file.name}`);
        console.error(error);
      } else {
        const { data } = supabase.storage.from("designer-portfolio").getPublicUrl(filePath);
        newFiles.push({ path: filePath, name: file.name, url: data.publicUrl });
      }
    }

    setKnowledgeFiles((prev) => [...prev, ...newFiles]);
    setKbUploading(false);
  };

  const handleKbDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setKbDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    await uploadKnowledgeFiles(files);
  }, [sessionId]);

  const handleKbFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await uploadKnowledgeFiles(files);
  };

  const removeKnowledgeFile = async (file: UploadedFile) => {
    const { error } = await supabase.storage.from("designer-portfolio").remove([file.path]);
    if (error) {
      toast.error("Ошибка удаления файла");
      return;
    }
    setKnowledgeFiles((prev) => prev.filter(f => f.path !== file.path));
    toast.success("Файл удалён");
  };

  const stripAnalysisHeader = (text: string, header: string) => {
    return text
      .replace(/\*\*/g, '')
      .replace(new RegExp(`^\\s*(?:\\d+\\.\\s*)?${header}\\s*[:—–-]?\\s*`, 'i'), '')
      .trim();
  };

  const cleanAnalysisContent = (text: string) => {
    return text
      .replace(/\*\*/g, '')
      .replace(/\n+\s*(?:\d+[.)]\s*)?(?:КАК Я БУДУ ЭТО ПРИМЕНЯТЬ|ХОЧУ УТОЧНИТЬ)\s*[:—–-]?[\s\S]*$/i, '')
      .replace(/\s+(?:\d+[.)])\s*$/g, '')
      .trim();
  };

  const formatAnalysisBlock = (header: string, text: string) => {
    return `${header}\n${cleanAnalysisContent(stripAnalysisHeader(text, header))}`;
  };

  const countExpandedSentences = (text: string) => {
    const cleaned = cleanAnalysisContent(stripAnalysisHeader(text, 'ЧТО Я ВИЖУ'))
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned
      .split(/(?<=[.!?…])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 35).length;
  };

  const countActionItems = (text: string) => {
    const cleaned = cleanAnalysisContent(stripAnalysisHeader(text, 'КАК Я БУДУ ЭТО ПРИМЕНЯТЬ'));

    const lineItems = cleaned
      .split('\n')
      .map((line) => line.replace(/^[-—•]\s*/, '').replace(/^\d+[.)]\s*/, '').trim())
      .filter((line) => (
        line.length >= 35 &&
        !/^(как я буду это применять|секция|пункт|хочу уточнить)/i.test(line)
      ));

    if (lineItems.length >= 2) {
      return lineItems.length;
    }

    return cleaned
      .replace(/\s+/g, ' ')
      .split(/(?=\s*(?:\d+[.)]\s+|[-—•]\s+|В брифе\b|В concept[- ]?board\b|В концепт[- ]?борде\b|Из референсов\b|При конфликте\b|В генерации\b|Для борда\b))/i)
      .map((item) => item.replace(/^[-—•]\s*/, '').replace(/^\d+[.)]\s*/, '').trim())
      .filter((item) => item.length >= 35).length;
  };

  const countMatches = (text: string, patterns: RegExp[]) => {
    return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
  };

  const validateProfileAnalysis = (whatISee: string, howIApply: string, sources: ExtractedSource[] = []) => {
    const sentenceCount = countExpandedSentences(whatISee);
    const actionCount = countActionItems(howIApply);
    const issues: string[] = [];
    const qualityIssues: string[] = [];

    if (sentenceCount < 10) {
      issues.push(`блок "Что я вижу" слишком короткий: ${sentenceCount}/10 развёрнутых предложений`);
    }
    if (actionCount < 10) {
      issues.push(`блок "Как я буду это применять" слишком короткий: ${actionCount}/10 пунктов`);
    }

    const combined = `${whatISee}\n${howIApply}`.toLowerCase();
    const materialSignals = countMatches(combined, [
      /дерев|шпон|кам[её]н|мрамор|травертин|бетон|металл|латун|стекл|текстил|лен|кож|керамик|штукатур|микроцемент/,
      /материал|фактур|тактиль|поверхност/,
    ]);
    const colorSignals = countMatches(combined, [
      /беж|молоч|песоч|сер|графит|корич|терракот|олив|зел[её]н|син|голуб|ч[её]рн|бел|тепл|холод/,
      /палитр|цвет|оттен/,
    ]);
    const compositionSignals = countMatches(combined, [
      /компози|симметр|асимметр|ритм|масштаб|пропорц|вертикал|горизонтал|акцент|плоскост|слой|воздух/,
      /зонирован|сценари|планиров|баланс/,
    ]);
    const processSignals = countMatches(howIApply.toLowerCase(), [
      /бриф|клиент|анкета|сценари/,
      /concept[- ]?board|концепт[- ]?борд|мудборд|борд/,
      /референс|исключу|отсеку|фильтр/,
      /генерац|промпт|визуализац/,
    ]);

    if (materialSignals < 2) {
      qualityIssues.push("мало конкретных материалов/фактур");
    }
    if (colorSignals < 2) {
      qualityIssues.push("мало конкретики по цветам/палитре");
    }
    if (compositionSignals < 2) {
      qualityIssues.push("мало композиционных принципов");
    }
    if (processSignals < 3) {
      qualityIssues.push("в практическом блоке мало действий для брифа, бордов, референсов или генерации");
    }

    const readableSources = sources.filter((source) => (
      (source.originalCharCount ?? source.text.length) >= 1000 &&
      !/без доступного текстового слоя|недоступен|ошибка/i.test(source.note || "")
    ));
    if (readableSources.length > 0) {
      const mentionsSource = readableSources.some((source) => {
        const lowerName = source.file.name.toLowerCase();
        const stem = lowerName.replace(/\.[^.]+$/, "");
        return combined.includes(lowerName) || (stem.length >= 8 && combined.includes(stem));
      });
      if (!mentionsSource) {
        qualityIssues.push("нет ссылки на прочитанный файл-источник");
      }
    }

    return {
      ok: issues.length === 0 && qualityIssues.length === 0,
      issues: [...issues, ...qualityIssues],
      sentenceCount,
      actionCount,
      qualityIssues,
    };
  };

  const invokeProfileAnalysis = async (
    systemPrompt: string,
    userPrompt: string,
    imageUrls?: string[],
    pdfFiles?: Pick<UploadedFile, "path" | "name">[],
  ) => {
    const { data, error } = await supabase.functions.invoke('analyze-profile', {
      body: { systemPrompt, userPrompt, imageUrls, pdfFiles },
    });

    const text = data?.text || "";
    if (error || !text.trim()) {
      const detail = data?.details ? ` (${String(data.details).slice(0, 200)})` : "";
      const message = error?.message || data?.error || "Нет ответа от AI";
      throw new Error(`${message}${detail}`);
    }

    return text.trim();
  };

  const isTextExtractableFile = (file: UploadedFile) => {
    const lowerName = file.name.toLowerCase();
    const lowerPath = file.path.toLowerCase();
    return [".pdf", ".txt", ".md", ".docx"].some((ext) => lowerName.endsWith(ext) || lowerPath.endsWith(ext));
  };

  const isPdfFile = (file: UploadedFile) => {
    const lowerName = file.name.toLowerCase();
    const lowerPath = file.path.toLowerCase();
    return lowerName.endsWith(".pdf") || lowerPath.endsWith(".pdf");
  };

  const isUnreadablePdfSource = (source: ExtractedSource) => {
    return isPdfFile(source.file) && /pdf без доступного текстового слоя|текст недоступен|ошибка/i.test(source.note || source.text);
  };

  const extractSourceFile = async (
    file: UploadedFile,
    source: ExtractedSource["source"],
  ): Promise<ExtractedSource> => {
    try {
      const { data, error } = await supabase.functions.invoke('extract-text', {
        body: { filePath: file.path },
      });

      const text = error || !data?.text ? "текст недоступен" : String(data.text);
      return {
        file,
        source,
        text,
        truncated: Boolean(data?.truncated),
        originalCharCount: typeof data?.originalCharCount === "number" ? data.originalCharCount : text.length,
        includedCharCount: text.length,
        pageCount: typeof data?.pageCount === "number" ? data.pageCount : null,
        fileSizeBytes: typeof data?.fileSizeBytes === "number" ? data.fileSizeBytes : null,
        note: error ? "ошибка извлечения" : data?.note,
      };
    } catch {
      return {
        file,
        source,
        text: "ошибка чтения",
        includedCharCount: 0,
        pageCount: null,
        fileSizeBytes: null,
        note: "ошибка чтения",
      };
    }
  };

  const buildExtractedSourcesBlock = (sources: ExtractedSource[]) => {
    if (sources.length === 0) return "";

    let remaining = EXTRACTED_SOURCE_TEXT_BUDGET;
    const blocks: string[] = [];

    for (const source of sources) {
      const sourceLabel = `${source.source}: ${source.file.name}`;
      const sourceText = source.text.trim();
      const textForPrompt = remaining > 0 ? sourceText.slice(0, remaining) : "";
      const promptTruncated = sourceText.length > textForPrompt.length;
      remaining -= textForPrompt.length;

      blocks.push([
        `### ${sourceLabel}`,
        `Статус: ${source.note || "текст извлечён"}; символов извлечено: ${source.originalCharCount ?? sourceText.length}; включено в анализ: ${textForPrompt.length}${source.truncated || promptTruncated ? "; текст сокращён" : ""}.`,
        textForPrompt || "[Текст не включён: общий лимит источников исчерпан]",
      ].join("\n"));
    }

    return `\n\nИЗВЛЕЧЁННЫЙ ТЕКСТ ИЗ ФАЙЛОВ (опирайся на эти источники, называй файл при конкретных выводах):\n${blocks.join("\n\n---\n\n")}`;
  };

  const buildAnalysisDebug = (
    sources: ExtractedSource[],
    portfolioImagesTotal: number,
    portfolioImagesSent: number,
    pdfFilesSentToVision: number,
    portfolioDocumentsTotal: number,
    knowledgeFilesTotal: number,
  ): AnalysisDebug => {
    let remaining = EXTRACTED_SOURCE_TEXT_BUDGET;
    const debugSources = sources.map((source) => {
      const sourceTextLength = source.text.trim().length;
      const includedCharCount = Math.max(0, Math.min(sourceTextLength, remaining));
      remaining -= includedCharCount;

      return {
        name: source.file.name,
        source: source.source,
        note: source.note || "текст извлечён",
        originalCharCount: source.originalCharCount ?? sourceTextLength,
        includedCharCount,
        pageCount: source.pageCount ?? null,
        fileSizeBytes: source.fileSizeBytes ?? null,
        truncated: Boolean(source.truncated || sourceTextLength > includedCharCount),
      };
    });
    const warnings: string[] = [];
    const unreadablePdfSources = debugSources.filter((source) => /pdf без доступного текстового слоя/i.test(source.note));
    const unreadablePdfCount = unreadablePdfSources.length;
    if (unreadablePdfCount > 0) {
      warnings.push(`PDF без текстового слоя: ${unreadablePdfCount}. Система попробует проанализировать их как визуальные PDF.`);
    }
    const oversizedVisualPdfs = unreadablePdfSources.filter((source) => (
      (typeof source.pageCount === "number" && source.pageCount > MAX_PDF_PAGES_FOR_FILE_INPUT)
      || (typeof source.fileSizeBytes === "number" && source.fileSizeBytes > MAX_PDF_BYTES_FOR_FILE_INPUT)
    ));
    if (oversizedVisualPdfs.length > 0) {
      warnings.push(`Большие PDF не будут отправлены целиком в AI: ${oversizedVisualPdfs.map((source) => {
        const details = [
          source.pageCount ? `${source.pageCount} стр.` : "",
          source.fileSizeBytes ? `${(source.fileSizeBytes / 1024 / 1024).toFixed(1)} МБ` : "",
        ].filter(Boolean).join(", ");
        return `${source.name}${details ? ` (${details})` : ""}`;
      }).join(", ")}. Разбейте файл на главы до ${MAX_PDF_PAGES_FOR_FILE_INPUT} страниц или загрузите DOCX/TXT.`);
    }

    const includedKnowledgeChars = debugSources
      .filter((source) => source.source === "База знаний")
      .reduce((sum, source) => sum + source.includedCharCount, 0);
    if (knowledgeFilesTotal > 0 && includedKnowledgeChars < 1000) {
      warnings.push("Из базы знаний включено меньше 1000 символов. Лучше загрузить DOCX или PDF с текстовым слоем.");
    }

    return {
      portfolioImagesTotal,
      portfolioImagesSent,
      pdfFilesSentToVision,
      portfolioDocumentsTotal,
      knowledgeFilesTotal,
      promptTextBudget: EXTRACTED_SOURCE_TEXT_BUDGET,
      promptTextIncluded: debugSources.reduce((sum, source) => sum + source.includedCharCount, 0),
      warnings,
      sources: debugSources,
    };
  };

  // Analyze profile with OpenAI
  const analyzeProfile = async () => {
    if (!profile.designer_name && !profile.style_description && !profile.custom_ergonomics_text) {
      toast.error("Заполните хотя бы одно поле профиля для анализа");
      return;
    }

    setAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisDebug(null);

    try {
      // Save form fields before AI calls so data survives any failure
      await upsertDesignerProfile({
        ...profile,
        style_refs: [...uploadedFiles.map(f => f.path), ...knowledgeFiles.map(f => f.path)],
      });

      const portfolioDocumentFiles = uploadedFiles.filter(isTextExtractableFile);
      const sourceFiles = [
        ...portfolioDocumentFiles.map((file) => ({ file, source: "Портфолио" as const })),
        ...knowledgeFiles.map((file) => ({ file, source: "База знаний" as const })),
      ];

      const extractedSources = await Promise.all(
        sourceFiles.map(({ file, source }) => extractSourceFile(file, source)),
      );
      const unreadablePdfSources = extractedSources.filter(isUnreadablePdfSource);
      const oversizedVisualPdfSources = unreadablePdfSources.filter((source) => (
        (typeof source.pageCount === "number" && source.pageCount > MAX_PDF_PAGES_FOR_FILE_INPUT)
        || (typeof source.fileSizeBytes === "number" && source.fileSizeBytes > MAX_PDF_BYTES_FOR_FILE_INPUT)
      ));
      const visualPdfFiles = unreadablePdfSources
        .filter((source) => !oversizedVisualPdfSources.includes(source))
        .slice(0, 2)
        .map((source) => ({ path: source.file.path, name: source.file.name }));

      const portfolioImagesTotal = uploadedFiles.filter((file) => !isTextExtractableFile(file)).length;
      const portfolioImagesSent = Math.min(portfolioImagesTotal, 6);
      setAnalysisDebug(buildAnalysisDebug(
        extractedSources,
        portfolioImagesTotal,
        portfolioImagesSent,
        visualPdfFiles.length,
        portfolioDocumentFiles.length,
        knowledgeFiles.length,
      ));

      const sourceSummary = [
        `Изображения портфолио: ${portfolioImagesTotal} загружено, ${portfolioImagesSent} отправлено в vision.`,
        `PDF без текстового слоя: ${visualPdfFiles.length} отправлено как PDF-файл в vision/file input; ${oversizedVisualPdfSources.length} слишком больших PDF пропущено.`,
        `Документы портфолио: ${portfolioDocumentFiles.map((file) => file.name).join(", ") || "нет"}.`,
        `Файлы базы знаний: ${knowledgeFiles.map((file) => file.name).join(", ") || "нет"}.`,
      ].join("\n");

      const extractedSourcesBlock = buildExtractedSourcesBlock(extractedSources);

      const baseContextPrompt = `Имя: ${profile.designer_name || "Не указано"}
Описание стиля: ${profile.style_description || "Не заполнено"}
Визуальный язык (шкалы 1-10): ${Object.entries(profile.ergonomics_rules || {}).map(([k,v]) => `${k}: ${v}`).join(', ')}
Стандарты и ограничения: ${profile.custom_ergonomics_text || "Не заполнено"}
СВОДКА ИСТОЧНИКОВ:
${sourceSummary}${extractedSourcesBlock}`;

      // Image URLs for vision analysis (non-PDF portfolio files only, max 6)
      const portfolioImageUrls = uploadedFiles
        .filter((file) => !isTextExtractableFile(file))
        .slice(0, 6)
        .map(f => f.url);

      const digestPrompt = `Ты — аналитик дизайн-системы студии. Сначала сделай SOURCE DIGEST по профилю, файлам и изображениям. Ответь на русском, только структурированной выжимкой без вступления.

Разделы:
- Палитры и цвета: конкретные оттенки, температура, насыщенность.
- Материалы и фактуры: только наблюдаемые или явно названные материалы.
- Формы и композиция: ритм, пропорции, сетка, плотность, акценты.
- Повторяющиеся приёмы портфолио: что видно в проектах/мудбордах.
- Запреты и отсечения: что дизайнер избегает.
- Клиентский процесс: как это влияет на бриф, согласование, конфликт с пожеланиями клиента.
- Источники и уверенность: по каждому файлу/изображениям укажи, насколько источник реально прочитан или виден.

Если PDF не дал текст, так и напиши: "источник не прочитан как текст"; не выдумывай содержание файла по имени.`;

      if (oversizedVisualPdfSources.length > 0) {
        throw new Error(`PDF слишком большой для анализа целиком: ${oversizedVisualPdfSources.map((source) => source.file.name).join(", ")}. Разбейте его на главы до ${MAX_PDF_PAGES_FOR_FILE_INPUT} страниц или загрузите DOCX/TXT.`);
      }

      let sourceDigest = "";
      try {
        sourceDigest = await invokeProfileAnalysis(digestPrompt, baseContextPrompt, portfolioImageUrls, visualPdfFiles);
      } catch (pdfInputError) {
        console.warn("PDF file input failed, retrying without PDF:", pdfInputError);
        const pdfErrorMessage = pdfInputError instanceof Error ? pdfInputError.message : String(pdfInputError);
        const contextLimitExceeded = /context window|exceeds the context/i.test(pdfErrorMessage);
        const warningMessage = contextLimitExceeded
          ? `PDF слишком большой для передачи целиком — анализ выполнен на основе текста и изображений. Разбейте файл на главы до ${MAX_PDF_PAGES_FOR_FILE_INPUT} страниц или загрузите DOCX/TXT.`
          : "PDF-файл без текстового слоя не удалось передать в AI — анализ выполнен на основе текста и изображений.";
        setAnalysisDebug((prev) => prev ? ({
          ...prev,
          pdfFilesSentToVision: 0,
          warnings: [...prev.warnings, warningMessage],
        }) : prev);
        // Retry without PDF — text budget (45 000 chars) and images are sufficient
        sourceDigest = await invokeProfileAnalysis(digestPrompt, baseContextPrompt, portfolioImageUrls);
      }
      const baseUserPrompt = `${baseContextPrompt}

SOURCE DIGEST:
${sourceDigest}`;

      // TWO parallel AI calls — one per block — to bypass max_tokens limit
      // Block 1 prompt: "ЧТО Я ВИЖУ"
      const promptBlock1 = `Ты — куратор дизайн-студии. Проанализируй стиль дизайнера по данным профиля. Если есть "БАЗА ЗНАНИЙ ДИЗАЙНЕРА" — прочитай полностью и цитируй. ОТВЕЧАЙ НА РУССКОМ, ТОЛЬКО текст секции.

Напиши "ЧТО Я ВИЖУ" — ровно 15 развёрнутых предложений о стиле дизайнера. Каждое предложение — новая конкретная мысль. Обязательно используй SOURCE DIGEST: назови минимум 2 материала/фактуры, 2 цвета или палитры, 2 композиционных принципа и 1 вывод про клиентский процесс. Объясняй КАК ИМЕННО и ПОЧЕМУ, избегай общих фраз. Разбери: общую эстетику, цвета и оттенки, материалы и фактуры, приёмы из портфолио, стандарты и принципы, подход к клиенту, итоговую характеристику. Если вывод основан на прочитанном файле, упоминай источник по имени файла. Если источник не прочитан как текст, не выдумывай его содержание. Не пиши "Хочу уточнить" и не задавай вопросы.`;

      // Block 2 prompt: "КАК Я БУДУ ЭТО ПРИМЕНЯТЬ"
      const promptBlock2 = `Ты — куратор дизайн-студии. На основе профиля дизайнера напиши практические рекомендации. ОТВЕЧАЙ НА РУССКОМ, ТОЛЬКО текст секции.

Напиши "КАК Я БУДУ ЭТО ПРИМЕНЯТЬ" — ровно 15 конкретных пунктов-действий. Каждый с новой строки, без нумерации. Это должен быть операционный стандарт, а не описание стиля: формулируй через действия "В брифе буду проверять...", "В concept-board зафиксирую...", "Из референсов исключу...", "При конфликте клиента с профилем предложу...", "В генерации борда укажу...". По 3 пункта на шкалу: температура (цвета), строгость (компоновка), фактурность (материалы), цветность (палитра), стиль (направленность). Опирай действия на SOURCE DIGEST, профиль, извлечённые документы и видимые изображения портфолио; избегай универсальных советов, которые подошли бы любому дизайнеру. Не пиши "Хочу уточнить" и не задавай вопросы.`;

      let text1 = await invokeProfileAnalysis(promptBlock1, baseUserPrompt, portfolioImageUrls);
      let text2 = await invokeProfileAnalysis(promptBlock2, baseUserPrompt, portfolioImageUrls);
      text1 = formatAnalysisBlock('ЧТО Я ВИЖУ', text1);
      text2 = formatAnalysisBlock('КАК Я БУДУ ЭТО ПРИМЕНЯТЬ', text2);

      let validation = validateProfileAnalysis(text1, text2, extractedSources);
      let retried = false;

      if (!validation.ok) {
        retried = true;
        toast.info("AI вернул слишком короткий анализ, пробую расширить результат");

        const retryTasks: Promise<string>[] = [];
        const retryTargets: Array<"whatISee" | "howIApply"> = [];
        const retryQualityOnly = validation.sentenceCount >= 10 && validation.actionCount >= 10 && validation.qualityIssues.length > 0;

        if (validation.sentenceCount < 10 || retryQualityOnly) {
          retryTargets.push("whatISee");
          retryTasks.push(invokeProfileAnalysis(
            `${promptBlock1}

Предыдущий ответ был слишком коротким или слишком общим. Перепиши секцию заново: минимум 10, лучше 15 развёрнутых предложений. Не сжимай мысли в один абзац, не обобщай, опирайся на SOURCE DIGEST, все доступные поля профиля, базу знаний и портфолио. Обязательно назови материалы, палитру, композиционные принципы, клиентский процесс и прочитанные источники, если они действительно прочитаны. Верни только секцию "ЧТО Я ВИЖУ".`,
            baseUserPrompt,
            portfolioImageUrls,
          ));
        }

        if (validation.actionCount < 10 || retryQualityOnly) {
          retryTargets.push("howIApply");
          retryTasks.push(invokeProfileAnalysis(
            `${promptBlock2}

Предыдущий ответ был слишком коротким, слишком общим или плохо разделён на пункты. Перепиши секцию заново: верни ровно 15 строк, каждая строка начинается с "- " и содержит одно конкретное действие длиной минимум 35 символов. Обязательно используй форматы действий: "В брифе буду проверять...", "В concept-board зафиксирую...", "Из референсов исключу...", "При конфликте клиента с профилем предложу...", "В генерации борда укажу...". Не объединяй пункты в абзац. Верни только секцию "КАК Я БУДУ ЭТО ПРИМЕНЯТЬ".`,
            baseUserPrompt,
            portfolioImageUrls,
          ));
        }

        const retryResults = await Promise.all(retryTasks);
        retryResults.forEach((retryText, idx) => {
          if (retryTargets[idx] === "whatISee") {
            text1 = formatAnalysisBlock('ЧТО Я ВИЖУ', retryText);
          }
          if (retryTargets[idx] === "howIApply") {
            text2 = formatAnalysisBlock('КАК Я БУДУ ЭТО ПРИМЕНЯТЬ', retryText);
          }
        });

        validation = validateProfileAnalysis(text1, text2, extractedSources);
      }

      setAnalysisDebug((prev) => prev ? ({
        ...prev,
        validation: {
          sentenceCount: validation.sentenceCount,
          actionCount: validation.actionCount,
          retried,
          qualityIssues: validation.qualityIssues,
        },
      }) : prev);

      const hasUsableDraft = validation.sentenceCount >= 5 || validation.actionCount >= 5 || `${text1}\n${text2}`.length >= 1200;
      if (!validation.ok) {
        setAnalysisDebug((prev) => prev ? ({
          ...prev,
          warnings: [
            ...prev.warnings,
            `Анализ показан как черновик: ${validation.issues.join("; ")}.`,
          ],
        }) : prev);

        if (!hasUsableDraft) {
          throw new Error(`AI вернул слишком короткий анализ: ${validation.issues.join("; ")}`);
        }
      }

      const analysisText = [text1, text2].filter(Boolean).join('\n\n');
      
      setAnalysisResult(analysisText);
      
      // Save to database — clear old answered Q&A when new analysis is generated
      const { _qa: _removed, ...otherConstraints } = profile.hard_constraints || {};
      await upsertDesignerProfile({
        ...profile,
        hard_constraints: otherConstraints,
        ai_analysis: analysisText,
        ai_questions: [],
      });

      toast.success("Анализ сохранён");
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const is429 = /429|rate limit|too many requests/i.test(raw);
      const message = is429
        ? "Превышен лимит AI-запросов. Подождите 1 минуту и попробуйте снова, или уменьшите количество загруженных файлов."
        : raw || "Ошибка анализа профиля";
      toast.error(message);
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-display">
              {profile.designer_name ? `Стандарты ${profile.designer_name}` : "Мои стандарты"}
            </h1>
            <p className="text-sm text-muted-foreground">Настройте один раз — применяется ко всем проектам</p>
          </div>
        </div>

        <div className="space-y-10">
          {/* Block 0 — Designer Name */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Как вас зовут?</h2>
            <Input
              placeholder="Имя или имя и фамилия"
              value={profile.designer_name || ""}
              onChange={(e) => setProfile((p) => ({ ...p, designer_name: e.target.value }))}
            />
          </section>

          {/* Block 1 — Visual Language Sliders */}
          <section className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Мой визуальный язык</h2>
              <p className="text-sm text-muted-foreground">Отметьте, где находится ваш стиль по каждой шкале</p>
            </div>
            <div className="space-y-6">
              {VISUAL_SLIDERS.map((slider) => (
                <div key={slider.key} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{slider.left}</span>
                    <span className="text-muted-foreground">{slider.right}</span>
                  </div>
                  <Slider
                    value={[profile.ergonomics_rules[slider.key] || 5]}
                    onValueChange={(v) => updateSlider(slider.key, v)}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-center">
                    <span className="text-xs text-muted-foreground">
                      {profile.ergonomics_rules[slider.key] || 5}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Block 2 — Style Description */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Мой стиль</h2>
            <Textarea
              placeholder="Опишите свой подход своими словами — как вы объясняете его клиентам"
              value={profile.style_description}
              onChange={(e) => setProfile((p) => ({ ...p, style_description: e.target.value }))}
              className="min-h-[120px]"
            />
          </section>

          {/* Block 3 — Portfolio Upload */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Мои проекты и мудборды</h2>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              }`}
            >
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileInput}
                className="hidden"
                id="portfolio-upload"
              />
              <label htmlFor="portfolio-upload" className="cursor-pointer block">
                <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">Перетащите файлы сюда или кликните для выбора</p>
                <p className="text-xs text-muted-foreground">JPG, PNG, PDF до 10 МБ</p>
              </label>
              {uploading && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загрузка...
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Загрузите фото своих проектов, мудборды или PDF портфолио — AI проанализирует ваш стиль автоматически
            </p>
            {/* Uploaded files preview */}
            {uploadedFiles.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
                {uploadedFiles.map((file, idx) => (
                  <div key={idx} className="relative group aspect-square border rounded-lg overflow-hidden">
                    {file.name.endsWith(".pdf") ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-muted p-2">
                        <FileText className="h-8 w-8 text-muted-foreground mb-1" />
                        <span className="text-xs text-center truncate w-full">{file.name}</span>
                      </div>
                    ) : (
                      <img
                        src={file.url}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <button
                      onClick={() => removeFile(file)}
                      className="absolute top-1 right-1 p-1 bg-background/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Block 5 — Standards and Constraints */}
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Мои стандарты и ограничения</h2>
              <p className="text-sm text-muted-foreground">Правила, которые вы всегда применяете в работе</p>
            </div>
            <Textarea
              placeholder="Например: не использую ламинат и натяжные потолки, рабочий треугольник обязателен на кухне, минимальный проход 90 см, всегда предусматриваю хранение у входа..."
              value={profile.custom_ergonomics_text || ""}
              onChange={(e) => setProfile((p) => ({ ...p, custom_ergonomics_text: e.target.value }))}
              className="min-h-[120px]"
            />
          </section>

          {/* Block 6 — Knowledge Base */}
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">База знаний</h2>
              <p className="text-sm text-muted-foreground">Загрузите курс, методичку или свои наработки — AI извлечёт стандарты автоматически</p>
            </div>
            <div
              onDragEnter={handleKbDrag}
              onDragLeave={handleKbDrag}
              onDragOver={handleKbDrag}
              onDrop={handleKbDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                kbDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              }`}
            >
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.txt"
                onChange={handleKbFileInput}
                className="hidden"
                id="knowledge-upload"
              />
              <label htmlFor="knowledge-upload" className="cursor-pointer block">
                <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">Перетащите файлы сюда или кликните для выбора</p>
                <p className="text-xs text-muted-foreground">PDF, DOCX, TXT до 20 МБ</p>
              </label>
              {kbUploading && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загрузка...
                </div>
              )}
            </div>
            {/* Knowledge files list */}
            {knowledgeFiles.length > 0 && (
              <div className="space-y-2 mt-4">
                {knowledgeFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-muted px-3 py-2 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                    </div>
                    <button
                      onClick={() => removeKnowledgeFile(file)}
                      className="p-1 text-muted-foreground hover:text-destructive flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Save & Analyze */}
          <div className="pt-4 space-y-4">
            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? "Сохранение..." : "Сохранить профиль"}
              </Button>
              <Button onClick={analyzeProfile} disabled={analyzing} variant="outline" className="flex-1">
                {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {analyzing ? "Анализ..." : "Проанализировать профиль"}
              </Button>
            </div>

            {/* Analysis Result */}
            {analyzing && (
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                <div className="h-4 bg-muted rounded animate-pulse w-full" />
                <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
              </div>
            )}

            {analysisDebug && (
              <details className="bg-white border border-[#E5E5E5] rounded-xl p-5 shadow-sm space-y-4" open={analysisDebug.warnings.length > 0}>
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[16px] font-semibold text-[#2D2D2D]">Источники учтены</h3>
                      <p className="text-[13px] text-muted-foreground mt-1">
                        {analysisDebug.sources.length} файлов, {analysisDebug.portfolioImagesSent}/{analysisDebug.portfolioImagesTotal} изображений в vision, {analysisDebug.pdfFilesSentToVision} PDF в file input
                      </p>
                    </div>
                    {analysisDebug.validation && (
                      <div className="text-right text-[12px] text-muted-foreground">
                        <div>{analysisDebug.validation.sentenceCount}/10 предложений</div>
                        <div>{analysisDebug.validation.actionCount}/10 пунктов</div>
                      </div>
                    )}
                  </div>
                </summary>

                <div className="pt-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#2D2D2D]">Источники анализа</h3>
                    <p className="text-[13px] text-muted-foreground mt-1">
                      Проверка того, какие материалы реально попали в AI.
                    </p>
                  </div>
                  {analysisDebug.validation && (
                    <div className="text-right text-[12px] text-muted-foreground">
                      <div>{analysisDebug.validation.sentenceCount}/10 предложений</div>
                      <div>{analysisDebug.validation.actionCount}/10 пунктов</div>
                    </div>
                  )}
                </div>

                {analysisDebug.warnings.length > 0 && (
                  <div className="space-y-2">
                    {analysisDebug.warnings.map((warning) => (
                      <p key={warning} className="text-[12px] text-[#8A5A2B] bg-[#FFF7ED] border border-[#FED7AA] rounded-lg px-3 py-2">
                        {warning}
                      </p>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-[13px] text-[#2D2D2D]">
                  <div className="bg-muted/40 rounded-lg px-3 py-2">
                    Изображения: {analysisDebug.portfolioImagesSent}/{analysisDebug.portfolioImagesTotal} в vision
                  </div>
                  <div className="bg-muted/40 rounded-lg px-3 py-2">
                    PDF в AI: {analysisDebug.pdfFilesSentToVision} как file input
                  </div>
                  <div className="bg-muted/40 rounded-lg px-3 py-2">
                    Текст: {analysisDebug.promptTextIncluded}/{analysisDebug.promptTextBudget} символов
                  </div>
                  <div className="bg-muted/40 rounded-lg px-3 py-2">
                    PDF/документы портфолио: {analysisDebug.portfolioDocumentsTotal}
                  </div>
                  <div className="bg-muted/40 rounded-lg px-3 py-2">
                    База знаний: {analysisDebug.knowledgeFilesTotal}
                  </div>
                </div>

                {analysisDebug.sources.length > 0 ? (
                  <div className="space-y-2">
                    {analysisDebug.sources.map((source) => (
                      <div key={`${source.source}-${source.name}`} className="border border-[#E5E5E5] rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[13px] font-medium text-[#2D2D2D] truncate">{source.name}</span>
                          <span className="text-[11px] text-muted-foreground flex-shrink-0">{source.source}</span>
                        </div>
                        <div className="text-[12px] text-muted-foreground mt-1">
                          {source.note}; извлечено {source.originalCharCount}, включено {source.includedCharCount}
                          {source.truncated ? "; сокращено" : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground">
                    Текстовые файлы не найдены. Анализ опирается на поля профиля и изображения портфолио.
                  </p>
                )}

                {analysisDebug.validation?.retried && (
                  <p className="text-[12px] text-muted-foreground">
                    Первый ответ был коротким или слишком общим, поэтому система автоматически запросила расширенную версию.
                  </p>
                )}
                {analysisDebug.validation && analysisDebug.validation.qualityIssues.length > 0 && (
                  <p className="text-[12px] text-muted-foreground">
                    Контроль качества: {analysisDebug.validation.qualityIssues.join("; ")}.
                  </p>
                )}
                </div>
              </details>
            )}

            {/* Helper: extract section between two headers (case-insensitive, handles ** bold, em-dash separators) */}
            {analysisResult && (() => {
              const stripBold = (s: string) => s.replace(/\*\*/g, '');
              const clean = stripBold(analysisResult);

              const extractBetween = (text: string, from: string, to?: string): string => {
                // Match header: optional "1. " prefix, header text, then optional separator (colon, em-dash, spaces) — NOT content on same line
                const fromRe = new RegExp(`(?:\\d+\\.\\s*)?${from}(?:\\s*[:—–]?\\s*)?`, 'i');
                const match = text.match(fromRe);
                if (!match) return '';

                const after = text.slice(match.index! + match[0].length);
                if (!to) return cleanup(after);

                const toRe = new RegExp(`(?:\\d+\\.\\s*)?${to}(?:\\s*[:—–]?\\s*)?`, 'i');
                const endMatch = after.match(toRe);
                const result = endMatch ? after.slice(0, endMatch.index!) : after;
                return cleanup(result);
              };

              const cleanup = (s: string): string => {
                return cleanAnalysisContent(s);
              };

              const splitNumberedThoughts = (text: string) => {
                const normalized = text.replace(/\s+/g, ' ').trim();
                const numbered = normalized
                  .split(/(?=\b\d{1,2}[.)]\s+)/)
                  .map((item) => item.replace(/^\d{1,2}[.)]\s*/, '').trim())
                  .filter((item) => item.length > 20);

                if (numbered.length >= 3) return numbered;

                return normalized
                  .split(/(?<=[.!?…])\s+/)
                  .map((item) => item.trim())
                  .filter((item) => item.length > 20);
              };

              const splitActionItems = (text: string) => {
                const lines = text
                  .split('\n')
                  .map((line) => line.trim())
                  .filter((line) => line && line.length > 3);

                const lineItems = lines
                  .map((line) => line.replace(/^[-—•.]\s*/, '').replace(/^\d{1,2}[.)]\s*/, '').trim())
                  .filter((line) => !/^(это\s+применять|применять|секция|пункт)/i.test(line));

                if (lineItems.length >= 3) return lineItems;

                return text
                  .replace(/\s+/g, ' ')
                  .split(/(?=\s*(?:\d{1,2}[.)]\s+|[-—•.]\s+|В брифе\b|В concept[- ]?board\b|В концепт[- ]?борде\b|Из референсов\b|При конфликте\b|В генерации\b|Для борда\b))/i)
                  .map((item) => item.replace(/^[-—•.]\s*/, '').replace(/^\d{1,2}[.)]\s*/, '').trim())
                  .filter((item) => item.length > 20);
              };

              const whatISee = extractBetween(clean, 'ЧТО Я ВИЖУ', 'КАК Я БУДУ ЭТО ПРИМЕНЯТЬ');
              const howIApply = extractBetween(clean, 'КАК Я БУДУ ЭТО ПРИМЕНЯТЬ', 'ХОЧУ УТОЧНИТЬ');
              const whatISeeItems = splitNumberedThoughts(whatISee);
              const howIApplyItems = splitActionItems(howIApply);

              return (
                <div className="space-y-6">
                  {/* Section 1: What I See */}
                  <div className="bg-white border border-[#E5E5E5] rounded-xl p-6 shadow-sm">
                    <h3 className="text-[18px] font-semibold text-[#2D2D2D] mb-4">Что я вижу</h3>
                    {whatISeeItems.length > 0 ? (
                      <ol className="space-y-3 text-[15px] leading-relaxed text-[#2D2D2D]">
                        {whatISeeItems.map((item, i) => (
                          <li key={i} className="grid grid-cols-[28px_1fr] gap-3">
                            <span className="text-[13px] text-muted-foreground pt-0.5">{i + 1}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-muted-foreground italic">(нет данных)</p>
                    )}
                  </div>

                  {/* Section 2: How I'll Apply */}
                  <div className="bg-white border border-[#E5E5E5] rounded-xl p-6 shadow-sm">
                    <h3 className="text-[18px] font-semibold text-[#2D2D2D] mb-4">Как я буду это применять</h3>
                    {howIApplyItems.length > 0 ? (
                      <div className="space-y-2 text-[15px] leading-relaxed text-[#2D2D2D]">
                        {howIApplyItems.map((item, i) => (
                          <p key={i} className="grid grid-cols-[18px_1fr] gap-3">
                            <span className="text-primary pt-0.5">•</span>
                            <span>{item}</span>
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic">(нет данных)</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignerProfilePage;
