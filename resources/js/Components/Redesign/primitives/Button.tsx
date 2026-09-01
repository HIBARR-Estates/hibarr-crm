import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "ghost" | "primary" | "navy";
type Size = "base" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    icon?: ReactNode;
    loading?: boolean;
    /**
     * Bare icon trigger (row actions like open/download/remove) — skips the
     * `.dr-btn` chrome (padding, background, border, min-height) entirely so
     * `className` fully controls the look instead of a variant/size.
     */
    iconOnly?: boolean;
}

/** Sizes/variants ported 1:1 from v2.2's .v22-btn system. */
export default function Button({
    variant = "ghost",
    size = "base",
    icon,
    children,
    className,
    style,
    loading,
    disabled,
    iconOnly = false,
    ...props
}: ButtonProps) {
    const classes = iconOnly
        ? className
        : [
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
                    style={{
                        width: size === "sm" ? 12 : 14,
                        height: size === "sm" ? 12 : 14,
                    }}
                >
                    <span
                        className="animate-spin rounded-full border-2 border-solid border-current border-t-transparent"
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
