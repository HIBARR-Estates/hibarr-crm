import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";

export type ScopePickerItem = { value: string | number; label: string };

/**
 * Compact multi-select for pipeline scopes: selected values as removable
 * pills, plus a search field that opens a capped dropdown of remaining
 * options — same idea as the Blade pipeline-scope-pills widget, without
 * dumping every option into an endless chip wall.
 */
export default function ScopePicker({
    items,
    selected,
    onChange,
    disabled,
    placeholder,
}: {
    items: ScopePickerItem[];
    selected: Array<string | number>;
    onChange: (next: Array<string | number>) => void;
    disabled?: boolean;
    placeholder?: string;
}) {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedKeys = useMemo(() => selected.map(String), [selected]);
    const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

    const selectedItems = useMemo(() => {
        const byKey = new Map(items.map((item) => [String(item.value), item]));
        return selectedKeys
            .map((key) => byKey.get(key))
            .filter((item): item is ScopePickerItem => !!item);
    }, [items, selectedKeys]);

    const available = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items.filter((item) => {
            if (selectedSet.has(String(item.value))) return false;
            if (!q) return true;
            return item.label.toLowerCase().includes(q);
        });
    }, [items, query, selectedSet]);

    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, [open]);

    const add = (value: string | number) => {
        if (selectedSet.has(String(value))) return;
        onChange([...selected, value]);
        setQuery("");
        inputRef.current?.focus();
    };

    const remove = (value: string | number) => {
        onChange(selected.filter((v) => String(v) !== String(value)));
    };

    if (!items.length) {
        return <div style={{ fontSize: 13, color: T.TEXT_MUTED }}>—</div>;
    }

    return (
        <div
            ref={rootRef}
            style={{
                opacity: disabled ? 0.55 : 1,
                pointerEvents: disabled ? "none" : undefined,
            }}
        >
            {selectedItems.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                    {selectedItems.map((item) => (
                        <button
                            key={String(item.value)}
                            type="button"
                            onClick={() => remove(item.value)}
                            title={t("app.remove")}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                maxWidth: "100%",
                                padding: "4px 8px 4px 10px",
                                borderRadius: 999,
                                border: `1px solid ${T.BLUE}`,
                                background: T.BLUE_LIGHT,
                                color: T.BLUE_DARK,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                lineHeight: 1.3,
                            }}
                        >
                            <span className="min-w-0 truncate">{item.label}</span>
                            <Icon name="x" size={12} color={T.BLUE_DARK} />
                        </button>
                    ))}
                </div>
            )}

            <div style={{ position: "relative" }}>
                <input
                    ref={inputRef}
                    className="dr-input"
                    value={query}
                    disabled={disabled}
                    placeholder={placeholder || t("app.search")}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            setOpen(false);
                            return;
                        }
                        if (e.key === "Enter" && available[0]) {
                            e.preventDefault();
                            add(available[0].value);
                        }
                        if (e.key === "Backspace" && !query && selected.length) {
                            remove(selected[selected.length - 1]);
                        }
                    }}
                    aria-expanded={open}
                    aria-autocomplete="list"
                />

                {open && (
                    <div
                        role="listbox"
                        style={{
                            position: "absolute",
                            zIndex: 20,
                            left: 0,
                            right: 0,
                            top: "calc(100% + 4px)",
                            maxHeight: 200,
                            overflowY: "auto",
                            background: T.WHITE,
                            border: `1px solid ${T.BORDER}`,
                            borderRadius: 8,
                            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                        }}
                    >
                        {available.length === 0 ? (
                            <div
                                style={{
                                    padding: "10px 12px",
                                    fontSize: 13,
                                    color: T.TEXT_MUTED,
                                }}
                            >
                                {query.trim()
                                    ? t("modules.deal.pipelineScopeNoMatches")
                                    : t("modules.deal.pipelineScopeAllSelected")}
                            </div>
                        ) : (
                            available.map((item) => (
                                <button
                                    key={String(item.value)}
                                    type="button"
                                    role="option"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => add(item.value)}
                                    style={{
                                        display: "block",
                                        width: "100%",
                                        textAlign: "left",
                                        padding: "8px 12px",
                                        border: "none",
                                        background: "transparent",
                                        cursor: "pointer",
                                        fontSize: 13,
                                        color: T.TEXT,
                                        borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = T.SURFACE_2;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "transparent";
                                    }}
                                >
                                    {item.label}
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            <div
                style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: T.TEXT_HINT,
                }}
            >
                {t("modules.deal.pipelineScopeSelectedCount", {
                    count: String(selected.length),
                })}
            </div>
        </div>
    );
}
