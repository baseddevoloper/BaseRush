import React from "react";
import { cn } from "../../lib/utils";

export function Badge({ className, variant = "default", ...props }) {
  const styles = {
    default: "bg-primary/20 text-primary border border-primary/30",
    success: "bg-success/20 text-success border border-success/30",
    danger: "bg-danger/20 text-danger border border-danger/30",
    muted: "bg-muted text-muted-foreground border border-border"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        styles[variant] || styles.default,
        className
      )}
      {...props}
    />
  );
}
