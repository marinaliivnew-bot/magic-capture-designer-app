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
        "group relative flex flex-col overflow-hidden border transition-all duration-350 focus:outline-none",
        selected
          ? "border-primary"
          : "border-border hover:border-primary/50"
      )}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-border">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={label}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-350",
              imgLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 bg-muted-foreground/10" />
          </div>
        )}

        {/* Selection checkmark */}
        {selected && (
          <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center bg-primary text-primary-foreground">
            <Check className="h-3.5 w-3.5" strokeWidth={2} />
          </div>
        )}
      </div>

      {/* Label + attribution */}
      <div className="px-3 py-3 text-left">
        <p className="label-style text-foreground">{label}</p>
        {attribution && (
          <p className="mt-1 truncate text-[10px] font-light text-muted-foreground">{attribution}</p>
        )}
      </div>
    </button>
  );
};

export default StyleCard;
