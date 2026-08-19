import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useFloatingMenuPosition from "@/Components/Redesign/hooks/useFloatingMenuPosition";
import { TASK_ICON } from "../../config/taskDesignTokens";
import { TaskGlyph } from "./TaskGlyphs";

export interface ColorOption {
    value: string;
    label: string;
    /** Accent colour for the dot / icon. */
    color: string;
    /** Tinted pill background + text, used for the option chips. */
    bg: string;
    fg: string;
    /** Optional glyph path — priorities use their arrows, categories a dot. */
    d?: string;
    /** Square swatch instead of a round dot (categories). */
    square?: boolean;
}

interface TaskColorSelectProps {
    value: string | null;
    options: ColorOption[];
    placeholder: string;
    onChange: (value: string | null) => void;
    disabled?: boolean;
    /** Allows clearing back to no selection. */
    clearable?: boolean;
}

/**
 * Dropdown that keeps the colour of what's selected. The trigger shows the
 * option's accent (glyph or swatch) and text colour but always uses the
 * neutral field border — a coloured border on the trigger reads as a
 * validation error, so it is deliberately not used.
 */
export default function TaskColorSelect({
    value,
    options,
    placeholder,
    onChange,
    disabled = false,
    clearable = true,
}: TaskColorSelectProps) {
    const { td } = useTd();
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const floatStyle = useFloatingMenuPosition(open, triggerRef, {
        align: "left",
        maxHeight: 280,
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
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDocument);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocument);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const selected = options.find((option) => option.value === value) ?? null;

    const swatch = (option: ColorOption, size = 8) =>
        option.d ? (
            <TaskGlyph d={option.d} size={15} color={option.color} />
        ) : (
            <span
                style={{
                    width: size,
                    height: size,
                    borderRadius: option.square ? 2 : 999,
                    background: option.color,
                    flexShrink: 0,
                }}
            />
        );

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
                className="tasks-press flex w-full items-center gap-2"
                style={{
                    padding: "9px 12px",
                    borderRadius: 8,
                    // Neutral border regardless of the selected colour.
                    border: `1px solid ${open ? T.BLUE_MID : T.BORDER}`,
                    background: T.WHITE,
                    fontSize: 14,
                    fontWeight: selected ? 600 : 400,
                    color: selected ? selected.fg : T.TEXT_HINT,
                    cursor: disabled ? "default" : "pointer",
                    textAlign: "left",
                    opacity: disabled ? 0.6 : 1,
                }}
            >
                {selected ? swatch(selected) : null}
                <span className="min-w-0 flex-1 truncate">
                    {selected ? td(selected.label, { source: "en" }) : placeholder}
                </span>
                <span
                    style={{
                        display: "flex",
                        opacity: 0.5,
                        transform: open ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 160ms ease",
                    }}
                >
                    <TaskGlyph
                        d={TASK_ICON.chevron}
                        size={13}
                        color={T.TEXT_MUTED}
                        strokeWidth={2}
                    />
                </span>
            </button>

            {open &&
                floatStyle &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="listbox"
                        className="tasks-reveal"
                        style={{
                            ...floatStyle,
                            minWidth: 220,
                            padding: 8,
                            background: T.WHITE,
                            border: `1px solid ${T.BORDER}`,
                            borderRadius: 12,
                            boxShadow:
                                "0 16px 36px rgba(22,41,77,0.16), 0 2px 6px rgba(22,41,77,0.06)",
                        }}
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
                                    padding: "7px 8px",
                                    borderRadius: 8,
                                    border: "none",
                                    background: "transparent",
                                    fontSize: 13,
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
                                        padding: "7px 8px",
                                        borderRadius: 8,
                                        border: "none",
                                        background: "transparent",
                                        cursor: "pointer",
                                        textAlign: "left",
                                    }}
                                >
                                    {/* Each option previews its own colour. */}
                                    <span
                                        className="inline-flex items-center gap-1.5"
                                        style={{
                                            padding: "3px 10px",
                                            borderRadius: 999,
                                            fontSize: 12,
                                            fontWeight: 600,
                                            background: option.bg,
                                            color: option.fg,
                                        }}
                                    >
                                        {swatch(option, 7)}
                                        {td(option.label, { source: "en" })}
                                    </span>
                                    <span className="flex-1" />
                                    {active && (
                                        <TaskGlyph
                                            d={TASK_ICON.check}
                                            size={13}
                                            color={T.BLUE}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>,
                    document.body,
                )}
        </>
    );
}
