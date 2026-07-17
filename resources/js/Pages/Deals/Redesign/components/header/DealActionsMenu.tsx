import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTd } from "@/Hooks/useDynamicTranslation";
import DealIcon from "../primitives/DealIcon";
import useFloatingMenuPosition from "../../hooks/useFloatingMenuPosition";

interface DealActionsMenuProps {
    onAddNote: () => void;
    onAddTask: () => void;
    onScheduleMeeting: () => void;
    onDelete: () => void;
    canDelete: boolean;
}

/**
 * Deal "⋯" actions menu, ported from v2.2's ActionsMenu (deal-v2-2.jsx:1354-1407).
 * Only items with a real CRM endpoint are shown — Won/Lost and Lock/Unlock are
 * omitted (no user-facing backing).
 */
export default function DealActionsMenu({
    onAddNote,
    onAddTask,
    onScheduleMeeting,
    onDelete,
    canDelete,
}: DealActionsMenuProps) {
    const { td } = useTd();
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const floatStyle = useFloatingMenuPosition(open, btnRef, { align: "right" });

    useEffect(() => {
        if (!open) return undefined;
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

    const run = (action: () => void) => {
        setOpen(false);
        action();
    };

    const items: Array<{ label: string; action: () => void; danger?: boolean }> = [
        { label: td("Add note"), action: onAddNote },
        { label: td("Add task"), action: onAddTask },
        { label: td("Schedule meeting"), action: onScheduleMeeting },
    ];

    return (
        <div style={{ display: "inline-flex" }}>
            <button
                ref={btnRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={td("Deal actions")}
                onClick={() => setOpen((v) => !v)}
                className="dr-btn dr-btn-sm"
                style={{
                    background: "#ffffff",
                    color: "#5b6472",
                    border: "1px solid #e2e5ea",
                    padding: "5px 8px",
                }}
            >
                <DealIcon name="more" size={16} />
            </button>
            {open &&
                floatStyle &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        className="dr-menu"
                        role="menu"
                        style={{ ...floatStyle, minWidth: 200 }}
                    >
                        {items.map((item) => (
                            <button
                                key={item.label}
                                type="button"
                                role="menuitem"
                                className="dr-menu-item"
                                onClick={() => run(item.action)}
                            >
                                {item.label}
                            </button>
                        ))}
                        {canDelete && (
                            <>
                                <div className="dr-menu-sep" role="separator" />
                                <button
                                    type="button"
                                    role="menuitem"
                                    className="dr-menu-item danger"
                                    onClick={() => run(onDelete)}
                                >
                                    {td("Delete deal")}
                                </button>
                            </>
                        )}
                    </div>,
                    document.body,
                )}
        </div>
    );
}
