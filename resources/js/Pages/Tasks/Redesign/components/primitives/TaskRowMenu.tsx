import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useFloatingMenuPosition from "@/Components/Redesign/hooks/useFloatingMenuPosition";
import { TASK_ICON } from "../../config/taskDesignTokens";
import { TaskGlyph } from "./TaskGlyphs";

export interface TaskRowAction {
    key: string;
    label: string;
    danger?: boolean;
    onSelect: () => void;
}

/** The row-end "…" menu from the design's list rows. */
export default function TaskRowMenu({
    actions,
    ariaLabel,
}: {
    actions: TaskRowAction[];
    ariaLabel: string;
}) {
    const { td } = useTd();
    const [open, setOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const floatStyle = useFloatingMenuPosition(open, buttonRef, {
        align: "right",
        maxHeight: 260,
    });

    useEffect(() => {
        if (!open) return undefined;
        const onDocument = (event: MouseEvent) => {
            const target = event.target as Node;
            if (buttonRef.current?.contains(target)) return;
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

    if (actions.length === 0) return null;

    return (
        <span
            style={{ display: "inline-flex" }}
            onClick={(event) => event.stopPropagation()}
        >
            <button
                ref={buttonRef}
                type="button"
                aria-label={ariaLabel}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                style={{
                    display: "flex",
                    padding: 2,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    flexShrink: 0,
                }}
            >
                <TaskGlyph
                    d={TASK_ICON.more}
                    size={16}
                    color={T.TEXT_HINT}
                    strokeWidth={1.5}
                />
            </button>

            {open &&
                floatStyle &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="menu"
                        aria-label={ariaLabel}
                        style={{
                            ...floatStyle,
                            minWidth: 170,
                            padding: 6,
                            background: T.WHITE,
                            border: `1px solid ${T.BORDER}`,
                            borderRadius: 10,
                            boxShadow: "0 12px 28px rgba(22,41,77,0.14)",
                        }}
                    >
                        {actions.map((action) => (
                            <button
                                key={action.key}
                                type="button"
                                role="menuitem"
                                className="tasks-record-row"
                                onClick={() => {
                                    setOpen(false);
                                    action.onSelect();
                                }}
                                style={{
                                    display: "block",
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "8px 10px",
                                    borderRadius: 6,
                                    border: "none",
                                    background: "transparent",
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: action.danger ? T.RED : T.TEXT,
                                    cursor: "pointer",
                                }}
                            >
                                {td(action.label)}
                            </button>
                        ))}
                    </div>,
                    document.body,
                )}
        </span>
    );
}
