import type { CSSProperties, ReactNode } from "react";
import type { StatusTone } from "@/lib/format";

type StatusBadgeProps = {
  tone: StatusTone;
  size?: "sm" | "md";
  children: ReactNode;
  style?: CSSProperties;
};

export default function StatusBadge({ tone, size = "md", children, style }: StatusBadgeProps) {
  const padY = size === "sm" ? 2 : 3;
  const padX = size === "sm" ? 8 : 10;
  const fontSize = size === "sm" ? 11 : 12;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: `${padY}px ${padX}px`,
        borderRadius: 999,
        background: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.border}`,
        fontSize,
        fontWeight: 600,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
