import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border px-2 py-0.5 font-body text-[10px] font-medium uppercase tracking-[0.12em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-primary text-primary bg-transparent",
        secondary: "border-border text-muted-foreground bg-transparent",
        destructive: "border-destructive text-destructive bg-transparent",
        outline: "border-border text-foreground bg-transparent",
        critical:
          "border-[hsl(var(--color-critical))] text-[hsl(var(--color-critical))] bg-[hsl(var(--color-critical-bg))]",
        important:
          "border-[hsl(var(--color-important))] text-[hsl(var(--color-important))] bg-[hsl(var(--color-important-bg))]",
        optional:
          "border-border text-[hsl(var(--color-optional))] bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
