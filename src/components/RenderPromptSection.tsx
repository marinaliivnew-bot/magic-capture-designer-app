import { useState, useCallback } from "react";
import { Copy, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  extractRenderParams,
  assembleRenderPrompt,
  RENDER_PARAM_LABELS,
  type RenderPromptParams,
} from "@/lib/render-prompt";

interface Props {
  blocks: any[];
  brief: any;
  rooms: any[];
}

const PARAM_ORDER: (keyof RenderPromptParams)[] = [
  "stylistics",
  "dimensions",
  "materials",
  "palette",
  "lighting",
  "segment",
  "negatives",
];

const RenderPromptSection = ({ blocks, brief, rooms }: Props) => {
  const [copied, setCopied] = useState(false);

  const params = extractRenderParams(blocks, brief, rooms);
  const prompt = assembleRenderPrompt(params);

  const hasContent = Object.values(params).some((v) => v.trim().length > 0);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = prompt;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [prompt]);

  if (!hasContent) return null;

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-foreground">Рендер-промпт</h2>
        <span className="font-body text-[11px] uppercase tracking-[0.1em] text-muted-foreground border border-border px-2 py-0.5">
          Midjourney · Nano Banana
        </span>
      </div>

      <p className="mb-8 font-body text-[13px] text-muted-foreground leading-relaxed">
        Промпт собран автоматически из утверждённого концепта. Скопируйте и вставьте в генератор визуализации.
      </p>

      {/* 6 параметров */}
      <div className="mb-8 divide-y divide-border">
        {PARAM_ORDER.map((key) => {
          const value = params[key];
          if (!value) return null;
          return (
            <div key={key} className="py-4 grid grid-cols-[180px_1fr] gap-6 items-start">
              <span className="label-style text-foreground pt-0.5">
                {RENDER_PARAM_LABELS[key]}
              </span>
              <span className="font-body text-[14px] text-muted-foreground leading-relaxed">
                {value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Собранный промпт */}
      <div className="border border-border bg-[#FAFAF9]">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="label-style text-foreground">Готовый промпт</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 gap-1.5 text-[12px]"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-600">Скопировано</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Копировать
              </>
            )}
          </Button>
        </div>
        <pre className="px-5 py-5 font-body text-[13px] text-foreground leading-[1.7] whitespace-pre-wrap break-words">
          {prompt}
        </pre>
      </div>
    </section>
  );
};

export default RenderPromptSection;
