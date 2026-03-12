import React from "react";
import { cn } from "../../lib/utils";

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/50 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition",
            value === tab.value ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
