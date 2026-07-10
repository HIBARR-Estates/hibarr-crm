import { ReactNode } from "react";
import { LEAD_REDESIGN_TOKENS as T } from "../../../types";

interface LeadPanelHeaderProps {
    title: string;
    rightSlot?: ReactNode;
}

export default function LeadPanelHeader({
    title,
    rightSlot,
}: LeadPanelHeaderProps) {
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
            {rightSlot ? (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexShrink: 0,
                    }}
                >
                    {rightSlot}
                </div>
            ) : null}
        </div>
    );
}
