import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

function getProgressColor(value: number) {
  if (value <= 40) return "bg-[hsl(var(--color-critical))]";
  if (value <= 70) return "bg-[hsl(var(--color-important))]";
  return "bg-primary";
}

function getProgressTextColor(value: number) {
  if (value <= 40) return "text-[hsl(var(--color-critical))]";
  if (value <= 70) return "text-[hsl(var(--color-important))]";
  return "text-primary";
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-0.5 w-full overflow-hidden bg-border", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        "h-full w-full flex-1 transition-all duration-350",
        getProgressColor(value || 0)
      )}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress, getProgressTextColor };
