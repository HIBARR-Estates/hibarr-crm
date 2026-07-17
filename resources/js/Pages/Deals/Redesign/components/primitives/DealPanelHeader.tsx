import { ReactNode } from "react";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealPanelHeaderProps {
    title: string;
    rightSlot?: ReactNode;
    onClose?: () => void;
}

export default function DealPanelHeader({
    title,
    rightSlot,
    onClose,
}: DealPanelHeaderProps) {
    return (
        <div
            style={{
                background: T.NAVY,
                color: T.WHITE,
                padding: "12px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
            }}
        >
            <span
                style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                }}
            >
                {title}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                {rightSlot}
                {onClose && (
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "rgba(255,255,255,0.75)",
                            cursor: "pointer",
                            fontSize: 16,
                            lineHeight: 1,
                            padding: 2,
                        }}
                    >
                        X
                    </button>
                )}
            </div>
        </div>
    );
}
