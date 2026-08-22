import type { CSSProperties } from "react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

export const SMALL_INPUT: CSSProperties = {
    padding: "8px 10px",
    border: `1px solid ${T.BORDER}`,
    borderRadius: 8,
    fontSize: 15,
    color: T.TEXT,
    background: T.WHITE,
    width: "100%",
};

export function formatFileSize(bytes: number): string {
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
