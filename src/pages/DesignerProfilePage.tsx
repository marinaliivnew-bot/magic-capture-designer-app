// DesignerProfilePage - v2 with name field and AI analysis
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Loader2, Save, ArrowLeft, Plus, X, Upload, FileText, Trash2, Sparkles } from "lucide-react";
import { getDesignerProfile, upsertDesignerProfile, type DesignerProfile } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

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

const getSessionId = () => {
  let id = localStorage.getItem("designer_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("designer_session_id", id);
  }
  return id;
};

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
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [updatingAnalysis, setUpdatingAnalysis] = useState(false);

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [knowledgeFiles, setKnowledgeFiles] = useState<UploadedFile[]>([]);
  const [newRef, setNewRef] = useState("");
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
          if (ext.endsWith('.pdf') || ext.endsWith('.doc') || ext.endsWith('.docx') || ext.endsWith('.txt')) {
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
        if (data.ai_questions) {
          setAiQuestions(Array.isArray(data.ai_questions) ? data.ai_questions : []);
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
      // Combine portfolio files, knowledge files and link references
      const portfolioPaths = uploadedFiles.map(f => f.path);
      const kbPaths = knowledgeFiles.map(f => f.path);
      const linkRefs = profile.style_refs?.filter((ref: string) => ref.startsWith("http")) || [];
      await upsertDesignerProfile({
        ...profile,
        style_refs: [...portfolioPaths, ...kbPaths, ...linkRefs],
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

  // Knowledge base files upload (PDF, DOC, TXT)
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
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain"
    ];
    const validFiles = files.filter(f => validTypes.includes(f.type));

    if (validFiles.length === 0) {
      toast.error("Поддерживаются только PDF, DOC, DOCX и TXT");
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

  const addRef = () => {
    if (!newRef.trim()) return;
    setProfile((prev) => ({
      ...prev,
      style_refs: [...(prev.style_refs || []), newRef.trim()],
    }));
    setNewRef("");
  };

  const removeRef = (ref: string) => {
    setProfile((prev) => ({
      ...prev,
      style_refs: (prev.style_refs || []).filter((r) => r !== ref),
    }));
  };

  // Extract questions from AI analysis text
  const extractQuestions = (text: string): string[] => {
    const questions: string[] = [];
    const lines = text.split('\n');
    let inQuestionsSection = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes('ХОЧУ УТОЧНИТЬ') || trimmed.includes('3.')) {
        inQuestionsSection = true;
        continue;
      }
      if (inQuestionsSection && trimmed) {
        // Look for question patterns (starting with number, dash, or just ending with ?)
        if (trimmed.match(/^\d+\.|^-\s*|.*\?$/)) {
          const question = trimmed.replace(/^\d+\.\s*/, '').replace(/^-\s*-?\s*/, '').trim();
          if (question && question.length > 10) {
            questions.push(question);
          }
        }
      }
    }
    
    return questions.slice(0, 3); // Max 3 questions
  };

  // Analyze profile with OpenAI
  const analyzeProfile = async () => {
    if (!profile.designer_name && !profile.style_description && !profile.custom_ergonomics_text) {
      toast.error("Заполните хотя бы одно поле профиля для анализа");
      return;
    }

    setAnalyzing(true);
    setAnalysisResult(null);

    try {
     const linkRefs = profile.style_refs?.filter((ref: string) => ref.startsWith("http")) || [];
      const allFiles = [...uploadedFiles, ...knowledgeFiles];

      // Extract text from knowledge base files
      const extractedTexts = await Promise.all(
        knowledgeFiles.map(async (file) => {
          try {
            const { data, error } = await supabase.functions.invoke('extract-text', {
              body: { filePath: file.path }
            });
            if (error || !data?.text) return `[${file.name}]: текст недоступен`;
            return `[${file.name}]:\n${data.text}`;
          } catch {
            return `[${file.name}]: ошибка чтения`;
          }
        })
      );

      const knowledgeBaseText = extractedTexts.length > 0
        ? `\n\nБАЗА ЗНАНИЙ ДИЗАЙНЕРА (содержимое загруженных документов):\n${extractedTexts.join('\n\n---\n\n')}`
        : '';

      const systemPrompt = `Ты — профессиональный куратор дизайн-студии. Дизайнер заполнил профиль в инструменте Magic Capture.

ВАЖНО: если в сообщении есть раздел "БАЗА ЗНАНИЙ ДИЗАЙНЕРА" — прочитай его ПОЛНОСТЬЮ до начала анализа. Это реальные документы дизайнера — методички, курсы, наработки. Информацию из них считай уже известной и НЕ задавай вопросы по темам, которые там освещены.

Ответь на русском языке в три блока:

1. ЧТО Я ВИЖУ — кратко опиши стиль и подход дизайнера своими словами, опираясь в том числе на содержимое его документов (2-3 предложения)

2. КАК Я БУДУ ЭТО ПРИМЕНЯТЬ — конкретно как эти данные повлияют на генерацию брифов и концепт-бордов (3-4 пункта)

3. ХОЧУ УТОЧНИТЬ — задай 2-3 вопроса ТОЛЬКО о том, чего НЕТ ни в профиле, ни в загруженных документах. Если всё понятно — можно задать 1 вопрос или не задавать совсем.`;

      const userPrompt = `Имя: ${profile.designer_name || "Не указано"}
Описание стиля: ${profile.style_description || "Не заполнено"}
Визуальный язык (шкалы 1-10): ${Object.entries(profile.ergonomics_rules || {}).map(([k,v]) => `${k}: ${v}`).join(', ')}
Стандарты и ограничения: ${profile.custom_ergonomics_text || "Не заполнено"}
Ссылки на референсы: ${linkRefs.length > 0 ? linkRefs.join(", ") : "Нет"}
Портфолио (файлы): ${uploadedFiles.map(f => f.name).join(", ") || "Нет"}${knowledgeBaseText}`;

     
      const apiKey = import.meta.env.VITE_OPENAI_KEY;
      if (!apiKey) throw new Error("OpenAI API key not found");

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          max_tokens: 1500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

      const data = await response.json();
      const analysisText = data.choices?.[0]?.message?.content || "Не удалось получить анализ";
      
      setAnalysisResult(analysisText);
      
      // Extract questions from analysis
      const questions = extractQuestions(analysisText);
      setAiQuestions(questions);
      
      // Save to database
      await upsertDesignerProfile({
        ...profile,
        ai_analysis: analysisText,
        ai_questions: questions,
      });
      
      toast.success("Анализ сохранён");
    } catch (e) {
      toast.error("Ошибка анализа профиля");
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  // Update analysis with designer answers
  const updateAnalysisWithAnswers = async () => {
    if (Object.keys(answers).length === 0) {
      toast.error("Сначала ответьте на вопросы");
      return;
    }

    setUpdatingAnalysis(true);
    
    try {
      // Build Q&A text
      const qaText = Object.entries(answers)
        .map(([idx, answer]) => `${parseInt(idx) + 1}. ${aiQuestions[parseInt(idx)]}\nОтвет: ${answer}`)
        .join('\n\n');

      const systemPrompt = `Ты — профессиональный куратор дизайн-студии. Дизайнер ответил на уточняющие вопросы. Обнови секции "ЧТО Я ВИЖУ" и "КАК Я БУДУ ЭТО ПРИМЕНЯТЬ" с учётом новых данных.`;

      const userPrompt = `Вопросы и ответы дизайнера:\n${qaText}\n\nИсходный анализ:\n${analysisResult}\n\nОбнови анализ, сохранив структуру с тремя секциями.`;

      const apiKey = import.meta.env.VITE_OPENAI_KEY;
      if (!apiKey) throw new Error("OpenAI API key not found");

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          max_tokens: 1500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

      const data = await response.json();
      const updatedAnalysis = data.choices?.[0]?.message?.content || analysisResult;
      
      setAnalysisResult(updatedAnalysis);
      
      // Save to database
      await upsertDesignerProfile({
        ...profile,
        ai_analysis: updatedAnalysis,
      });
      
      toast.success("Анализ обновлён с учётом ваших ответов");
    } catch (e) {
      toast.error("Ошибка обновления анализа");
      console.error(e);
    } finally {
      setUpdatingAnalysis(false);
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

          {/* Block 4 — Reference Links */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Ссылки на референсы</h2>
            <div className="flex gap-2">
              <Input
                placeholder="https://pinterest.com/..."
                value={newRef}
                onChange={(e) => setNewRef(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRef()}
              />
              <Button type="button" variant="outline" onClick={addRef}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(profile.style_refs || [])
                .filter((ref: string) => ref.startsWith("http"))
                .map((ref: string) => (
                  <div key={ref} className="flex items-center gap-1 bg-muted px-3 py-1 rounded-full text-sm">
                    <a href={ref} target="_blank" rel="noreferrer" className="truncate max-w-[200px]">
                      {ref}
                    </a>
                    <button onClick={() => removeRef(ref)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
            </div>
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
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleKbFileInput}
                className="hidden"
                id="knowledge-upload"
              />
              <label htmlFor="knowledge-upload" className="cursor-pointer block">
                <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">Перетащите файлы сюда или кликните для выбора</p>
                <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, TXT до 20 МБ</p>
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

            {updatingAnalysis && (
              <div className="space-y-3">
                <div className="h-3 bg-primary/20 rounded animate-pulse w-full" />
                <p className="text-sm text-muted-foreground text-center">Обновляем анализ с учётом ваших ответов...</p>
              </div>
            )}

            {analysisResult && !analyzing && (
              <div className="space-y-6">
                {/* Section 1: What I See */}
                <div className="bg-white border border-[#E5E5E5] rounded-xl p-6 shadow-sm">
                  <h3 className="text-[18px] font-semibold text-[#2D2D2D] mb-4">Что я вижу</h3>
                  <div className="text-[15px] leading-relaxed text-[#2D2D2D]" style={{ color: '#2D2D2D' }}>
                    {(() => {
                      const section = analysisResult.split(/\d+\.\s*ЧТО Я ВИЖУ|ЧТО Я ВИЖУ/)[1]?.split(/\d+\.\s*КАК Я БУДУ|КАК Я БУДУ/)[0] || '';
                      return section.replace(/\*\*/g, '').trim() || analysisResult.split('\n').slice(0, 5).join('\n').replace(/\*\*/g, '');
                    })()}
                  </div>
                </div>

                {/* Section 2: How I'll Apply */}
                <div className="bg-white border border-[#E5E5E5] rounded-xl p-6 shadow-sm">
                  <h3 className="text-[18px] font-semibold text-[#2D2D2D] mb-4">Как я буду это применять</h3>
                  <div className="text-[15px] leading-relaxed text-[#2D2D2D] space-y-2" style={{ color: '#2D2D2D' }}>
                    {(() => {
                      const section = analysisResult.split(/\d+\.\s*КАК Я БУДУ|КАК Я БУДУ/)[1]?.split(/\d+\.\s*ХОЧУ УТОЧНИТЬ|ХОЧУ УТОЧНИТЬ/)[0] || '';
                      const cleanSection = section.replace(/\*\*/g, '').trim();
                      // Split by newlines and filter out empty lines
                      return cleanSection.split('\n').filter(line => line.trim()).map((line, i) => (
                        <p key={i} className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>{line.replace(/^-\s*/, '').trim()}</span>
                        </p>
                      ));
                    })()}
                  </div>
                </div>

                {/* Section 3: Questions */}
                <div className="bg-[#F8F6F3] border border-[#D4C8B8] rounded-xl p-6 shadow-sm">
                  <h3 className="text-[18px] font-semibold text-[#2D2D2D] mb-4">Хочу уточнить</h3>
                  
                  {aiQuestions.length > 0 ? (
                    <div className="space-y-4">
                      {aiQuestions.map((question, idx) => (
                        <div key={idx} className="space-y-2">
                          <p className="text-[15px] text-[#2D2D2D] font-medium">
                            {idx + 1}. {question.replace(/\*\*/g, '').trim()}
                          </p>
                          <Input
                            placeholder="Ваш ответ..."
                            value={answers[idx] || ""}
                            onChange={(e) => setAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                            className="bg-white text-[15px]"
                          />
                        </div>
                      ))}
                      
                      <Button 
                        onClick={updateAnalysisWithAnswers}
                        disabled={updatingAnalysis || Object.keys(answers).length === 0}
                        className="w-full mt-4"
                      >
                        {updatingAnalysis ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Обновление...</>
                        ) : (
                          <><Sparkles className="mr-2 h-4 w-4" /> Сохранить ответы и обновить анализ</>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-[15px] leading-relaxed text-[#2D2D2D] space-y-3">
                      {(() => {
                        const section = analysisResult.split(/\d+\.\s*ХОЧУ УТОЧНИТЬ|ХОЧУ УТОЧНИТЬ/)[1] || '';
                        const cleanSection = section.replace(/\*\*/g, '').trim();
                        // Try to extract numbered questions
                        const lines = cleanSection.split('\n').filter(line => line.trim());
                        return lines.map((line, i) => (
                          <p key={i} className="text-[15px] text-[#2D2D2D]">
                            {line.match(/^\d+\./) ? line : `${i + 1}. ${line}`}
                          </p>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignerProfilePage;
