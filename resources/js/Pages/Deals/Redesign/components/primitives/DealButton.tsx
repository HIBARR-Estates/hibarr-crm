import { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

type Variant = "ghost" | "primary" | "navy";

interface DealButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    icon?: ReactNode;
}

export default function DealButton({
    variant = "ghost",
    icon,
    children,
    style,
    ...props
}: DealButtonProps) {
    const common = {
        fontSize: 12,
        padding: "6px 11px",
        borderRadius: 6,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center" as const,
        gap: 4,
        transition: "all 0.15s",
    };

    const byVariant: Record<Variant, CSSProperties> = {
        ghost: {
            background: "transparent",
            color: T.TEXT_MUTED,
            border: `1px solid ${T.BORDER}`,
        },
        primary: {
            background: T.BLUE,
            color: T.WHITE,
            border: "none",
        },
        navy: {
            background: T.NAVY,
            color: T.WHITE,
            border: "none",
        },
    };

    return (
        <button type="button" style={{ ...common, ...byVariant[variant], ...style }} {...props}>
            {icon}
            {children}
        </button>
    );
}
