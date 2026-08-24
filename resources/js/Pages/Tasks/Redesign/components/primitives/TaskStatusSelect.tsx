import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useFloatingMenuPosition from "@/Components/Redesign/hooks/useFloatingMenuPosition";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { TASK_ICON, statusToken } from "../../config/taskDesignTokens";
import { TaskGlyph } from "./TaskGlyphs";

interface TaskStatusSelectProps {
    status: string;
    columns: TaskboardColumn[];
    loading?: boolean;
    disabled?: boolean;
    onChange: (slug: string, columnId: number) => void;
}

/**
 * Status pill exactly as drawn in the handoff: tinted capsule with a leading
 * dot, the column name, and a faint chevron — opening a menu of the board's
 * columns. Replaces the antd `TaskStatusDropdownPill` on this page so the
 * pill matches the rest of the redesign.
 */
export default function TaskStatusSelect({
    status,
    columns,
    loading = false,
    disabled = false,
    onChange,
}: TaskStatusSelectProps) {
    const { td } = useTd();
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const floatStyle = useFloatingMenuPosition(open, triggerRef, {
        align: "right",
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

    const sorted = [...columns].sort((a, b) => a.priority - b.priority);
    const current =
        sorted.find((column) => column.slug === status) ?? sorted[0];
    const token = statusToken(current?.slug);
    const label = current
        ? td(current.column_name, { source: "en" })
        : td(status.split("_").join(" "), { source: "en" });

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled || loading}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap"
                style={{
                    padding: "4px 11px",
                    borderRadius: 999,
                    fontSize: 14,
                    fontWeight: 600,
                    lineHeight: 1.5,
                    background: token.bg,
                    color: token.fg,
                    border: `1px solid ${token.border}`,
                    cursor: disabled || loading ? "default" : "pointer",
                    opacity: loading ? 0.65 : 1,
                }}
            >
                <span
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: token.fg,
                        flexShrink: 0,
                    }}
                />
                {label}
                {loading ? (
                    <span
                        aria-hidden="true"
                        className="animate-spin rounded-full border-2 border-solid border-current border-t-transparent"
                        style={{ width: 9, height: 9 }}
                    />
                ) : (
                    !disabled && (
                        <span style={{ display: "flex", opacity: 0.6 }}>
                            <TaskGlyph
                                d={TASK_ICON.chevron}
                                size={11}
                                strokeWidth={1.5}
                            />
                        </span>
                    )
                )}
            </button>

            {open &&
                floatStyle &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="menu"
                        style={{
                            ...floatStyle,
                            minWidth: 208,
                            padding: 8,
                            background: T.WHITE,
                            border: `1px solid ${T.BORDER}`,
                            borderRadius: 12,
                            boxShadow:
                                "0 16px 36px rgba(22,41,77,0.16), 0 2px 6px rgba(22,41,77,0.06)",
                        }}
                    >
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
                            {td("Move to")}
                        </div>
                        {sorted.map((column) => {
                            const optionToken = statusToken(column.slug);
                            const active = column.slug === current?.slug;
                            return (
                                <button
                                    key={column.id}
                                    type="button"
                                    role="menuitem"
                                    className="tasks-status-option flex w-full items-center gap-2.5"
                                    onClick={() => {
                                        setOpen(false);
                                        if (!active) {
                                            onChange(column.slug, column.id);
                                        }
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
                                    {/* Each option previews the pill it will
                                        become, so the menu reads as the pill set. */}
                                    <span
                                        className="inline-flex items-center gap-1.5 whitespace-nowrap"
                                        style={{
                                            padding: "3px 10px",
                                            borderRadius: 999,
                                            fontSize: 14,
                                            fontWeight: 600,
                                            lineHeight: 1.5,
                                            background: optionToken.bg,
                                            color: optionToken.fg,
                                            border: `1px solid ${optionToken.border}`,
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: 6,
                                                height: 6,
                                                borderRadius: 999,
                                                background: optionToken.fg,
                                            }}
                                        />
                                        {td(column.column_name, {
                                            source: "en",
                                        })}
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
