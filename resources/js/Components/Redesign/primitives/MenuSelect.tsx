import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import useFloatingMenuPosition from "../hooks/useFloatingMenuPosition";
import { REDESIGN_TOKENS as T } from "../tokens";

export interface MenuOption {
    value: string | number;
    label: string;
}

interface MenuSelectProps {
    value: string | number | null | undefined;
    options: MenuOption[];
    onChange: (value: string | number) => void;
    placeholder?: string;
    size?: "sm" | "md";
    disabled?: boolean;
    align?: "left" | "right";
    width?: number;
    /** Stretch trigger to fill the parent (e.g. ModalField). */
    fullWidth?: boolean;
    triggerStyle?: CSSProperties;
    triggerClassName?: string;
    /** Show a filter input at the top of the menu. */
    searchable?: boolean;
    searchPlaceholder?: string;
}

/**
 * Custom dropdown trigger + portal-rendered menu, replacing a native
 * <select> wherever the trigger needs to stay a fixed compact width.
 */
export default function MenuSelect({
    value,
    options,
    onChange,
    placeholder = "Select…",
    size = "md",
    disabled,
    align = "left",
    width,
    fullWidth = false,
    triggerStyle,
    triggerClassName,
    searchable = false,
    searchPlaceholder = "Search…",
}: MenuSelectProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const isDisabled = disabled || options.length === 0;
    const floatStyle = useFloatingMenuPosition(open, btnRef, {
        align,
        maxHeight: searchable ? 320 : 260,
    });

    useEffect(() => {
        if (!open) {
            setQuery("");
            return undefined;
        }
        const onDoc = (e: MouseEvent) => {
            const target = e.target as Node;
            if (btnRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    useEffect(() => {
        if (!open || !searchable) return;
        // Focus after the portal paints so the caret lands in the filter.
        const id = window.requestAnimationFrame(() => {
            searchRef.current?.focus();
        });
        return () => window.cancelAnimationFrame(id);
    }, [open, searchable]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!searchable || !q) return options;
        return options.filter((option) =>
            option.label.toLowerCase().includes(q),
        );
    }, [options, query, searchable]);

    const current = options.find((o) => String(o.value) === String(value));
    const sm = size === "sm";

    return (
        <div
            style={{
                display: fullWidth ? "flex" : "inline-flex",
                width: fullWidth ? "100%" : undefined,
                maxWidth: "100%",
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                ref={btnRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={isDisabled}
                onClick={() => setOpen((v) => !v)}
                className={
                    triggerClassName ??
                    (fullWidth
                        ? undefined
                        : `dr-btn dr-btn-ghost${sm ? " dr-btn-sm" : ""}`)
                }
                style={{
                    width: fullWidth ? "100%" : undefined,
                    maxWidth: fullWidth
                        ? "100%"
                        : width || (sm ? 150 : 190),
                    justifyContent: "space-between",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: fullWidth ? 8 : 5,
                    background: T.WHITE,
                    // Match `.redesign-modal-overlay .modal-field input` when
                    // fullWidth (modal forms); keep compact btn sizing elsewhere.
                    color: current ? T.TEXT : T.TEXT_MUTED,
                    border: `1px solid ${T.BORDER}`,
                    borderRadius: 8,
                    fontFamily: "inherit",
                    fontSize: fullWidth ? 14 : undefined,
                    fontWeight: fullWidth ? 400 : undefined,
                    padding: fullWidth ? "11px 12px" : undefined,
                    minHeight: fullWidth ? 44 : undefined,
                    lineHeight: fullWidth ? 1.25 : undefined,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    opacity: isDisabled ? 0.45 : 1,
                    boxSizing: "border-box",
                    ...triggerStyle,
                }}
            >
                <span
                    style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textAlign: "left",
                        flex: 1,
                        minWidth: 0,
                    }}
                >
                    {current ? current.label : placeholder}
                </span>
                {!isDisabled && (
                    <Icon
                        name={open ? "chevron-up" : "chevron-down"}
                        size={fullWidth ? 12 : 10}
                        color={T.TEXT_MUTED}
                    />
                )}
            </button>
            {open &&
                floatStyle &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        className="dr-menu"
                        role="menu"
                        style={{
                            ...floatStyle,
                            minWidth: fullWidth
                                ? btnRef.current?.offsetWidth || 170
                                : 170,
                            maxWidth: fullWidth ? 480 : 320,
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                            padding: searchable ? 6 : undefined,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {searchable ? (
                            <input
                                ref={searchRef}
                                className="dr-input"
                                type="search"
                                aria-label={searchPlaceholder}
                                placeholder={searchPlaceholder}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    // Keep typing from bubbling to page shortcuts /
                                    // closing the menu via Escape handled above.
                                    e.stopPropagation();
                                    if (e.key === "Escape") {
                                        setOpen(false);
                                    }
                                }}
                                style={{
                                    marginBottom: 6,
                                    fontSize: 12,
                                    padding: "8px 10px",
                                    flexShrink: 0,
                                }}
                            />
                        ) : null}
                        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
                            {filtered.length === 0 ? (
                                <div
                                    className="px-1.5 py-2 text-xs italic"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {query.trim()
                                        ? `No matches for "${query.trim()}"`
                                        : "No options"}
                                </div>
                            ) : (
                                filtered.map((o) => (
                                    <button
                                        key={o.value}
                                        type="button"
                                        role="menuitemradio"
                                        aria-checked={
                                            String(o.value) === String(value)
                                        }
                                        className="dr-menu-item"
                                        onClick={() => {
                                            setOpen(false);
                                            onChange(o.value);
                                        }}
                                    >
                                        <span
                                            style={{
                                                flex: 1,
                                                textAlign: "left",
                                            }}
                                        >
                                            {o.label}
                                        </span>
                                        {String(o.value) === String(value) && (
                                            <Icon
                                                name="check"
                                                size={12}
                                                color={T.BLUE}
                                            />
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>,
                    document.body,
                )}
        </div>
    );
}
