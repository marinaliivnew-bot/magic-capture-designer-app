import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StyleCardProps {
  label: string;
  imageUrl: string;
  attribution?: string;
  selected: boolean;
  onClick: () => void;
}

const StyleCard = ({ label, imageUrl, attribution, selected, onClick }: StyleCardProps) => {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring",
        selected
          ? "border-primary shadow-md ring-1 ring-primary/30"
          : "border-border hover:border-primary/40 hover:shadow-sm"
      )}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={label}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-300",
              imgLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted-foreground/20" />
          </div>
        )}

        {/* Selection checkmark */}
        {selected && (
          <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <Check className="h-4 w-4" />
          </div>
        )}
      </div>

      {/* Label + attribution */}
      <div className="px-3 py-2.5 text-left">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {attribution && (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{attribution}</p>
        )}
      </div>
    </button>
  );
};

export default StyleCard;
