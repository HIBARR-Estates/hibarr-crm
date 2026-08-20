import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import BulkActionBar from "@/Components/Redesign/primitives/BulkActionBar";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import useFloatingMenuPosition from "@/Components/Redesign/hooks/useFloatingMenuPosition";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { assigneeTone, statusToken } from "../config/taskDesignTokens";

interface UserOption {
    id: number;
    name: string;
    image?: string;
}

interface TasksBulkBarProps {
    count: number;
    columns: TaskboardColumn[];
    users: UserOption[];
    busy: boolean;
    canReassign: boolean;
    canDelete: boolean;
    allSelected: boolean;
    onToggleSelectAll: () => void;
    onSetStatus: (column: TaskboardColumn) => void;
    onReassign: (userId: number) => void;
    onDelete: () => void;
    onClear: () => void;
}

const barButtonStyle: React.CSSProperties = {
    padding: "5px 11px",
    borderRadius: 8,
    border: "none",
    background: T.WHITE,
    color: T.NAVY,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
};

/** Small navy-bar dropdown used for the status and assignee pickers. */
function BarMenu({
    label,
    disabled,
    children,
}: {
    label: string;
    disabled: boolean;
    children: (close: () => void) => React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const floatStyle = useFloatingMenuPosition(open, triggerRef, {
        align: "left",
        maxHeight: 300,
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

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                onClick={() => setOpen((value) => !value)}
                style={{ ...barButtonStyle, opacity: disabled ? 0.5 : 1 }}
            >
                {label}
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
                            boxShadow: "0 16px 36px rgba(22,41,77,0.16)",
                        }}
                    >
                        {children(() => setOpen(false))}
                    </div>,
                    document.body,
                )}
        </>
    );
}

/**
 * Bulk action bar for the list view's selection. Actions map to the existing
 * `tasks.apply_quick_action` endpoint, the same one the deal/lead workspace
 * task tabs already use.
 */
export default function TasksBulkBar({
    count,
    columns,
    users,
    busy,
    canReassign,
    canDelete,
    allSelected,
    onToggleSelectAll,
    onSetStatus,
    onReassign,
    onDelete,
    onClear,
}: TasksBulkBarProps) {
    const { td } = useTd();

    if (count === 0) return null;

    return (
        <BulkActionBar
            count={count}
            onClear={onClear}
            clearLabel={td("Clear")}
            selectedLabel={`${count} ${td("selected")}`}
            style={{ padding: "8px 12px" }}
            actionsGap={8}
        >
            <button
                type="button"
                style={barButtonStyle}
                onClick={onToggleSelectAll}
            >
                {allSelected ? td("Deselect all") : td("Select all")}
            </button>

            <BarMenu label={td("Set status")} disabled={busy}>
                {(close) =>
                    [...columns]
                        .sort((a, b) => a.priority - b.priority)
                        .map((column) => {
                            const token = statusToken(column.slug);
                            return (
                                <button
                                    key={column.id}
                                    type="button"
                                    role="menuitem"
                                    className="tasks-status-option flex w-full items-center"
                                    onClick={() => {
                                        close();
                                        onSetStatus(column);
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
                                    <span
                                        className="inline-flex items-center gap-1.5"
                                        style={{
                                            padding: "3px 10px",
                                            borderRadius: 999,
                                            fontSize: 14,
                                            fontWeight: 600,
                                            background: token.bg,
                                            color: token.fg,
                                            border: `1px solid ${token.border}`,
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: 6,
                                                height: 6,
                                                borderRadius: 999,
                                                background: token.fg,
                                            }}
                                        />
                                        {td(column.column_name, {
                                            source: "en",
                                        })}
                                    </span>
                                </button>
                            );
                        })
                }
            </BarMenu>

            {canReassign && (
                <BarMenu label={td("Reassign to")} disabled={busy}>
                    {(close) => (
                        <div style={{ maxHeight: 260, overflowY: "auto" }}>
                            {users.map((user) => (
                                <button
                                    key={user.id}
                                    type="button"
                                    role="menuitem"
                                    className="tasks-status-option flex w-full items-center gap-2.5"
                                    onClick={() => {
                                        close();
                                        onReassign(user.id);
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
                                    <Avatar
                                        size={24}
                                        initials={initialsFromName(user.name)}
                                        src={user.image}
                                        tone={assigneeTone(user.id)}
                                    />
                                    <span
                                        className="min-w-0 flex-1 truncate"
                                        style={{ fontSize: 15, color: T.TEXT }}
                                    >
                                        {user.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </BarMenu>
            )}

            {canDelete && (
                <button
                    type="button"
                    disabled={busy}
                    onClick={onDelete}
                    style={{
                        ...barButtonStyle,
                        background: T.RED,
                        color: T.WHITE,
                        opacity: busy ? 0.5 : 1,
                    }}
                >
                    {td("Delete")}
                </button>
            )}
        </BulkActionBar>
    );
}
