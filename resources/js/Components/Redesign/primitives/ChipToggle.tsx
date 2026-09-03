import type { ReactNode } from "react";
import { REDESIGN_TOKENS as T } from "../tokens";

interface ChipToggleProps {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
    /** "rect" (default) = 8px corners, for a small fixed choice (e.g. yes/no). "pill" = fully rounded, for a multi-select chip group. */
    shape?: "rect" | "pill";
}

/** Small toggleable button — filled/blue when active, outlined/muted otherwise. */
export default function ChipToggle({
    active,
    onClick,
    children,
    shape = "rect",
}: ChipToggleProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                fontSize: 13,
                fontWeight: 600,
                padding: shape === "pill" ? "7px 14px" : "8px 18px",
                borderRadius: shape === "pill" ? 999 : 8,
                cursor: "pointer",
                border: `1px solid ${active ? T.BLUE : T.BORDER}`,
                background: active ? T.BLUE_LIGHT : T.WHITE,
                color: active ? T.BLUE_DARK : T.TEXT_MUTED,
            }}
        >
            {children}
        </button>
    );
}
