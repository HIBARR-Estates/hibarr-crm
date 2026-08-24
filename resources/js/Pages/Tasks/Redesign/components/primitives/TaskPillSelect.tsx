import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useFloatingMenuPosition from "@/Components/Redesign/hooks/useFloatingMenuPosition";
import { TASK_ICON } from "../../config/taskDesignTokens";
import { TaskGlyph } from "./TaskGlyphs";

export interface PillOption {
    value: string;
    label: string;
    /** Pill fill / text / outline for this option. */
    bg: string;
    fg: string;
    border: string;
    /** Leading round dot (status, priority accents). */
    dot?: string;
    /** Leading glyph instead of a dot (priority arrows, category icons). */
    d?: string;
    /** Square swatch rather than a circle (categories). */
    square?: boolean;
}

interface TaskPillSelectProps {
    value: string | null;
    options: PillOption[];
    /** Shown when nothing is selected. */
    placeholder: string;
    onChange: (value: string | null) => void;
    disabled?: boolean;
    loading?: boolean;
    /** Allows clearing back to no selection. */
    clearable?: boolean;
    /** Caption above the option list, e.g. "Move to". */
    menuHeading?: string;
    /** Extra content rendered under the options (e.g. add-category row). */
    menuFooter?: ReactNode;
    menuWidth?: number;
    /** Menu option layout — one per row, or a 2-up grid for long lists. */
    columns?: 1 | 2;
    align?: "left" | "right";
}

/**
 * The list view's status pill, generalised. The trigger is a tinted capsule
 * carrying the selected option's own colours; the menu shows every option as
 * the pill it will become. Used for status, priority and category so all
 * three read as one control.
 */
export default function TaskPillSelect({
    value,
    options,
    placeholder,
    onChange,
    disabled = false,
    loading = false,
    clearable = false,
    menuHeading,
    menuFooter,
    menuWidth = 250,
    columns = 1,
    align = "left",
}: TaskPillSelectProps) {
    const { td } = useTd();
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const floatStyle = useFloatingMenuPosition(open, triggerRef, {
        align,
        maxHeight: 320,
    });

    useEffect(() => {
        if (!open) return undefined;
        const onDocument = (event: MouseEvent) => {
            const target = event.target as Node;
            if (triggerRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDocument);
        document.addEventListener("keydown", onKey, true);
        return () => {
            document.removeEventListener("mousedown", onDocument);
            document.removeEventListener("keydown", onKey, true);
        };
    }, [open]);

    const selected = options.find((option) => option.value === value) ?? null;

    const marker = (option: PillOption, size = 6) =>
        option.d ? (
            <TaskGlyph d={option.d} size={13} color={option.dot ?? option.fg} />
        ) : (
            <span
                style={{
                    width: option.square ? 7 : size,
                    height: option.square ? 7 : size,
                    borderRadius: option.square ? 2 : 999,
                    background: option.dot ?? option.fg,
                    flexShrink: 0,
                }}
            />
        );

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled || loading}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen((current) => !current);
                }}
                className="tasks-press inline-flex items-center gap-1.5 whitespace-nowrap"
                style={{
                    // Roomier than the list-view pill: this is a form control.
                    padding: "7px 13px",
                    borderRadius: 6,
                    fontSize: 15,
                    fontWeight: 600,
                    // Descenders (g, y, p) clip without explicit leading.
                    lineHeight: 1.5,
                    background: selected ? selected.bg : T.WHITE,
                    color: selected ? selected.fg : T.TEXT_MUTED,
                    border: `1px solid ${selected ? selected.border : T.BORDER}`,
                    cursor: disabled || loading ? "default" : "pointer",
                    opacity: loading ? 0.65 : 1,
                }}
            >
                {selected ? marker(selected) : null}
                {selected ? td(selected.label, { source: "en" }) : placeholder}
                {loading ? (
                    <span
                        aria-hidden="true"
                        className="animate-spin rounded-full border-2 border-solid border-current border-t-transparent"
                        style={{ width: 9, height: 9 }}
                    />
                ) : (
                    <span style={{ display: "flex", opacity: 0.6 }}>
                        <TaskGlyph
                            d={TASK_ICON.chevron}
                            size={11}
                            strokeWidth={1.5}
                        />
                    </span>
                )}
            </button>

            {open &&
                floatStyle &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="listbox"
                        className="tasks-reveal"
                        // Portals bubble React events to the parent tree, so a
                        // click in here would otherwise reach the modal
                        // overlay's dismiss handler.
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            ...floatStyle,
                            minWidth: menuWidth,
                            padding: 8,
                            background: T.WHITE,
                            border: `1px solid ${T.BORDER}`,
                            borderRadius: 12,
                            boxShadow:
                                "0 16px 36px rgba(22,41,77,0.16), 0 2px 6px rgba(22,41,77,0.06)",
                        }}
                    >
                        {menuHeading && (
                            <div
                                className="uppercase"
                                style={{
                                    padding: "4px 8px 8px",
                                    fontSize: 14,
                                    fontWeight: 700,
                                    letterSpacing: "0.05em",
                                    color: T.TEXT_HINT,
                                }}
                            >
                                {menuHeading}
                            </div>
                        )}

                        <div
                            style={
                                columns === 2
                                    ? {
                                          display: "grid",
                                          gridTemplateColumns: "1fr 1fr",
                                          gap: 2,
                                      }
                                    : undefined
                            }
                        >
                            {clearable && (
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={value === null}
                                    className="tasks-status-option flex w-full items-center gap-2"
                                    onClick={() => {
                                        setOpen(false);
                                        onChange(null);
                                    }}
                                    style={{
                                        padding: "9px 10px",
                                        borderRadius: 8,
                                        border: "none",
                                        background: "transparent",
                                        fontSize: 15,
                                        color: T.TEXT_HINT,
                                        cursor: "pointer",
                                        textAlign: "left",
                                    }}
                                >
                                    {placeholder}
                                </button>
                            )}

                            {options.map((option) => {
                                const active = option.value === value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        role="option"
                                        aria-selected={active}
                                        className="tasks-status-option flex w-full items-center gap-2"
                                        onClick={() => {
                                            setOpen(false);
                                            onChange(option.value);
                                        }}
                                        style={{
                                            padding: "9px 10px",
                                            borderRadius: 8,
                                            border: "none",
                                            background: "transparent",
                                            cursor: "pointer",
                                            textAlign: "left",
                                        }}
                                    >
                                        <span
                                            className="inline-flex min-w-0 items-center gap-1.5"
                                            style={{
                                                padding: "5px 12px",
                                                borderRadius: 6,
                                                fontSize: 15,
                                                fontWeight: 600,
                                                lineHeight: 1.5,
                                                background: option.bg,
                                                color: option.fg,
                                                border: `1px solid ${option.border}`,
                                            }}
                                        >
                                            {marker(option)}
                                            <span className="truncate">
                                                {td(option.label, {
                                                    source: "en",
                                                })}
                                            </span>
                                        </span>
                                        {columns === 1 && (
                                            <span className="flex-1" />
                                        )}
                                        {active && columns === 1 && (
                                            <TaskGlyph
                                                d={TASK_ICON.check}
                                                size={13}
                                                color={T.BLUE}
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {menuFooter}
                    </div>,
                    document.body,
                )}
        </>
    );
}
