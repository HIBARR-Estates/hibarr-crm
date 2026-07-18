import { CSSProperties, ReactNode } from "react";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

type BadgeVariant =
    | "blue"
    | "green"
    | "gray"
    | "navy"
    | "amber"
    | "red"
    | "teal";

interface DealBadgeProps {
    children: ReactNode;
    variant?: BadgeVariant;
    className?: string;
    style?: CSSProperties;
}

/**
 * v2.2 `.v22-pill` (deal-v2-2.jsx:379-390), inline-styled so it renders
 * identically outside the deal page (Leads Redesign imports it without
 * deal-redesign.css). Keep values in sync with `.dr-pill` in that file.
 */
export default function DealBadge({
    children,
    variant = "blue",
    className,
    style,
}: DealBadgeProps) {
    const variants: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
        blue: { bg: T.BLUE_LIGHT, color: "#14538c", border: T.BLUE_MID },
        green: { bg: T.GREEN_LIGHT, color: T.GREEN, border: T.GREEN_MID },
        gray: { bg: T.GRAY, color: T.GRAY_DARK, border: T.BORDER },
        navy: { bg: "#e8ecf2", color: T.NAVY, border: "#c7d0de" },
        amber: { bg: T.AMBER_SOFT, color: T.AMBER, border: T.AMBER_MID },
        red: { bg: T.RED_SOFT, color: T.RED, border: T.RED_MID },
        teal: { bg: T.TEAL_SOFT, color: T.TEAL, border: T.TEAL_MID },
    };

    const v = variants[variant];

    return (
        <span
            className={className}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 999,
                background: v.bg,
                color: v.color,
                border: `1px solid ${v.border}`,
                whiteSpace: "nowrap",
                ...style,
            }}
        >
            {children}
        </span>
    );
}
