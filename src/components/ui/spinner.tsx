import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "h-4 w-4",
  default: "h-6 w-6",
  lg: "h-8 w-8",
} as const;

export interface SpinnerProps {
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

function Spinner({ size = "default", className }: SpinnerProps) {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn(
        "animate-spin text-muted-foreground",
        SIZE_CLASSES[size],
        className
      )}
    />
  );
}

export { Spinner };
