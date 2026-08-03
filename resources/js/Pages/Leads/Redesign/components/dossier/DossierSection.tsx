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
                borderBottom: isLast ? "none" : "1px solid var(--lr-border-soft)",
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
                    color: "var(--lr-text)",
                }}
            >
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--lr-text-dim)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        flex: 1,
                    }}
                >
                    {td(title)}
                </span>
                {!open && (
                    <span
                        style={{
                            fontSize: 11,
                            color: "var(--lr-text-dim)",
                            fontWeight: 500,
                        }}
                    >
                        {filled}/{total}
                    </span>
                )}
                <span style={{ color: "var(--lr-text-muted)", display: "flex" }}>
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
