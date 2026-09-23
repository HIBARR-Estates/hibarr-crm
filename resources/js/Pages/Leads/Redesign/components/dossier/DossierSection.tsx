import { Icon } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { ReactNode } from "react";

interface DossierSectionProps {
    title: string;
    filled: number;
    total: number;
    open: boolean;
    onToggle: () => void;
    isLast?: boolean;
    children: ReactNode;
}

export default function DossierSection({
    title,
    filled,
    total,
    open,
    onToggle,
    isLast = false,
    children,
}: DossierSectionProps) {
    const { td } = useTd();

    return (
        <div
            style={{
                borderBottom: isLast ? "none" : "1px solid var(--dr-border-soft)",
            }}
        >
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "11px 0",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    color: "var(--dr-text)",
                }}
            >
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--dr-text-hint)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        flex: 1,
                    }}
                >
                    {td(title, { source: "en" })}
                </span>
                {!open && (
                    <span
                        style={{
                            fontSize: 11,
                            color: "var(--dr-text-hint)",
                            fontWeight: 500,
                        }}
                    >
                        {filled}/{total}
                    </span>
                )}
                <span style={{ color: "var(--dr-text-muted)", display: "flex" }}>
                    <Icon
                        name={open ? "chevron-up" : "chevron-down"}
                        size={14}
                    />
                </span>
            </button>

            {open && <div style={{ paddingBottom: 10 }}>{children}</div>}
        </div>
    );
}
