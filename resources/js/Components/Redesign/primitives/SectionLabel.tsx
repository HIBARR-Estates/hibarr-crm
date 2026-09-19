import type { CSSProperties, ReactNode } from "react";
import { REDESIGN_TOKENS as T } from "../tokens";

interface SectionLabelProps {
    children: ReactNode;
    style?: CSSProperties;
}

/** Small uppercase muted mini-header introducing a group of fields within a panel. */
export default function SectionLabel({ children, style }: SectionLabelProps) {
    return (
        <div
            style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: T.TEXT_MUTED,
                marginBottom: 10,
                ...style,
            }}
        >
            {children}
        </div>
    );
}
