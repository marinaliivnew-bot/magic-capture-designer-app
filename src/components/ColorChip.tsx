import { findNearestRAL, getLuminance } from "@/lib/ral-mapping";

interface ColorChipProps {
  hex: string;
  name: string;
  role: string;
  ral?: string;  // provided by AI; computed as fallback
}

const ROLE_LABELS: Record<string, string> = {
  стены: "Стены",
  пол: "Пол",
  акцент: "Акцент",
  текстиль: "Текстиль",
  детали: "Детали",
  потолок: "Потолок",
  мебель: "Мебель",
};

const ColorChip = ({ hex, name, role, ral }: ColorChipProps) => {
  const normalizedHex = hex.startsWith("#") ? hex : `#${hex}`;

  const nearestRAL = findNearestRAL(normalizedHex);
  const ralCode = ral || nearestRAL.code;
  const ralDelta = !ral; // computed, not from AI — show as approximate

  const luminance = getLuminance(normalizedHex);
  const isDark = luminance < 0.4;

  const roleLabel = ROLE_LABELS[role.toLowerCase()] ?? role;

  return (
    <div className="flex flex-col gap-2">
      {/* Swatch */}
      <div
        className="relative w-full aspect-square"
        style={{ backgroundColor: normalizedHex }}
      >
        {/* Role badge — top-left inside swatch */}
        <span
          className={`absolute top-2 left-2 text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 ${
            isDark
              ? "bg-white/15 text-white"
              : "bg-black/10 text-black/70"
          }`}
        >
          {roleLabel}
        </span>
      </div>

      {/* Labels below swatch */}
      <div className="space-y-0.5">
        <p className="text-[13px] font-medium text-foreground leading-tight">
          {name}
        </p>
        <p className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5">
          <span>{ralCode}</span>
          {ralDelta && (
            <span className="text-muted-foreground/50" title="Ближайший RAL, вычислен автоматически">
              ≈
            </span>
          )}
        </p>
        <p className="text-[10px] font-mono text-muted-foreground/50 uppercase">
          {normalizedHex.toUpperCase()}
        </p>
      </div>
    </div>
  );
};

export default ColorChip;
