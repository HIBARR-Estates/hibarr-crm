import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "ghost" | "primary";
type Size = "base" | "sm";

interface DealButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    icon?: ReactNode;
    loading?: boolean;
}

/** Sizes/variants ported 1:1 from v2.2's .v22-btn system (deal-v2-2.jsx:366-377). */
export default function DealButton({
    variant = "ghost",
    size = "base",
    icon,
    children,
    className,
    style,
    loading,
    disabled,
    ...props
}: DealButtonProps) {
    const classes = [
        "dr-btn",
        `dr-btn-${variant}`,
        size === "sm" ? "dr-btn-sm" : "",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <button
            type="button"
            className={classes}
            style={style}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <span
                    className="inline-flex items-center justify-center"
                    style={{ width: size === "sm" ? 12 : 14, height: size === "sm" ? 12 : 14 }}
                >
                    <span
                        className="animate-spin rounded-full border-2 border-current border-t-transparent"
                        style={{ width: "100%", height: "100%" }}
                    />
                </span>
            ) : (
                <>
                    {icon}
                    {children}
                </>
            )}
        </button>
    );
}
