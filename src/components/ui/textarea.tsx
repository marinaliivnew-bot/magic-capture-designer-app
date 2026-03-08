import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full border-0 border-b border-border bg-transparent px-0 py-3 font-body text-[15px] font-light text-foreground ring-offset-background transition-colors duration-300 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-b-primary disabled:cursor-not-allowed disabled:opacity-50 resize-y",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
