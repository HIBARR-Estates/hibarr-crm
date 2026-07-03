import { ReactNode } from "react";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

type BadgeVariant = "blue" | "green" | "gray" | "navy";

interface DealBadgeProps {
    children: ReactNode;
    variant?: BadgeVariant;
    className?: string;
}

export default function DealBadge({
    children,
    variant = "blue",
    className,
}: DealBadgeProps) {
    const variants: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
        blue: { bg: T.BLUE_LIGHT, color: T.BLUE, border: T.BLUE_MID },
        green: { bg: T.GREEN_LIGHT, color: T.GREEN, border: T.GREEN_MID },
        gray: { bg: T.GRAY, color: T.GRAY_DARK, border: T.GRAY_MID },
        navy: { bg: "#e8ecf2", color: T.NAVY, border: "#c8d0dc" },
    };

    const v = variants[variant];

    return (
        <span
            className={className}
            style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 10,
                background: v.bg,
                color: v.color,
                border: `0.5px solid ${v.border}`,
                fontWeight: 500,
                whiteSpace: "nowrap",
            }}
        >
            {children}
        </span>
    );
}
