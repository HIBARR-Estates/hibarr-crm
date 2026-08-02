import { CSSProperties, ReactNode } from "react";
import { REDESIGN_TOKENS as T } from "../tokens";

type BadgeVariant =
    | "blue"
    | "green"
    | "gray"
    | "navy"
    | "amber"
    | "red"
    | "teal";

interface BadgeProps {
    children: ReactNode;
    variant?: BadgeVariant;
    className?: string;
    style?: CSSProperties;
}

/**
 * Inline-styled pill badge so it renders identically without page-scoped CSS.
 * Keep values in sync with `.dr-pill` in redesign.css.
 */
export default function Badge({
    children,
    variant = "blue",
    className,
    style,
}: BadgeProps) {
    const variants: Record<
        BadgeVariant,
        { bg: string; color: string; border: string }
    > = {
        blue: { bg: T.BLUE_LIGHT, color: T.BLUE_DARK, border: T.BLUE_MID },
        green: { bg: T.GREEN_LIGHT, color: T.GREEN, border: T.GREEN_MID },
        gray: { bg: T.GRAY, color: T.GRAY_DARK, border: T.BORDER },
        navy: { bg: T.NAVY_SOFT, color: T.NAVY, border: T.NAVY_MID },
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
                fontSize: 12,
                fontWeight: 600,
                padding: "4px 11px",
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
