import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTd } from "@/Hooks/useDynamicTranslation";
import MultiUserIndicator from "@/Components/MultiUserIndicator";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { formatDateWithTime } from "@/Components/Redesign/adapters/dateFormat";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import { TASK_ICON } from "../config/taskDesignTokens";
import type { TaskViewModel } from "../adapters/taskViewModel";
import { TaskGlyph } from "./primitives/TaskGlyphs";
import TaskRecordIcon from "./primitives/TaskRecordIcon";
import TaskCommentsPanel from "./TaskCommentsPanel";
import useTaskComments from "../hooks/useTaskComments";
import useTaskCheckpoints from "../hooks/useTaskCheckpoints";

interface PersonOption {
    id: number;
    name: string;
    image?: string;
    designation_name?: string;
}

interface TaskDetailModalProps {
    vm: TaskViewModel | null;
    onClose: () => void;
    onEdit: () => void;
    onToggleDone: () => void;
    canWrite: boolean;
    toggling: boolean;
    /** Employees available to @mention in comments. */
    people: PersonOption[];
    currentUser: { id: number; name: string; image?: string | null };
}

const LABEL: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: T.TEXT_MUTED,
};

export default function TaskDetailModal({
    vm,
    onClose,
    onEdit,
    onToggleDone,
    canWrite,
    toggling,
    people,
    currentUser,
}: TaskDetailModalProps) {
    const { td } = useTd();
    const [newCheckpoint, setNewCheckpoint] = useState("");

    const comments = useTaskComments(vm?.id ?? null);
    const checkpoints = useTaskCheckpoints(vm?.id ?? null, vm?.task.subtasks);

    useEffect(() => {
        if (!vm) return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [vm, onClose]);

    useEffect(() => {
        if (!vm || typeof document === "undefined") return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, [vm]);

    useEffect(() => {
        setNewCheckpoint("");
    }, [vm?.id]);

    if (!vm || typeof document === "undefined") return null;

    const task = vm.task;
    const assigner = task.created_by ?? task.assigner;
    const doneCount = checkpoints.items.filter(
        (item) => item.status === "complete",
    ).length;

    return createPortal(
        <div
            className="redesign-modal-overlay tasks-modal-overlay"
            role="presentation"
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(22,41,77,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 48,
                padding: 24,
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={vm.title}
                onClick={(event) => event.stopPropagation()}
                className="tasks-modal-panel flex w-full overflow-hidden"
                style={{
                    minWidth: 880,
                    maxWidth: 920,
                    maxHeight: "88vh",
                    background: T.WHITE,
                    borderRadius: 14,
                    boxShadow: "0 20px 50px rgba(22,41,77,0.18)",
                }}
            >
                {/* ── Details column ───────────────────────────── */}
                <div className="flex min-w-0 flex-1 flex-col">
                    <div
                        className="flex-shrink-0"
                        style={{
                            padding: "16px 22px 14px",
                            background: T.SURFACE_2,
                            borderBottom: `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h2
                                    className="m-0"
                                    style={{
                                        fontSize: 18,
                                        fontWeight: 700,
                                        color: T.NAVY,
                                        lineHeight: 1.3,
                                        textDecoration: vm.titleDecoration,
                                    }}
                                >
                                    {vm.title}
                                </h2>
                            </div>
                            <button
                                type="button"
                                aria-label={td("Close")}
                                onClick={onClose}
                                style={{
                                    display: "flex",
                                    padding: 4,
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    color: T.TEXT_MUTED,
                                }}
                            >
                                <TaskGlyph
                                    d={TASK_ICON.x}
                                    size={17}
                                    strokeWidth={1.5}
                                />
                            </button>
                        </div>

                        {/* Status · category · priority, as plain text */}
                        <div
                            className="flex flex-wrap items-center gap-[7px]"
                            style={{
                                marginTop: 12,
                                fontSize: 15,
                                color: T.TEXT_MUTED,
                            }}
                        >
                            <span className="inline-flex items-center gap-1.5">
                                <span
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: 999,
                                        background: vm.status.dot,
                                    }}
                                />
                                {td(vm.status.label, { source: "en" })}
                            </span>
                            {vm.category && (
                                <>
                                    <span style={{ color: T.TEXT_HINT }}>·</span>
                                    <span
                                        className="inline-flex items-center gap-1.5"
                                        style={{
                                            color: vm.category.fg,
                                            fontWeight: 600,
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: 6,
                                                height: 6,
                                                borderRadius: 999,
                                                background: vm.category.dot,
                                            }}
                                        />
                                        {td(vm.category.label, { source: "en" })}
                                    </span>
                                </>
                            )}
                            <span style={{ color: T.TEXT_HINT }}>·</span>
                            <span className="inline-flex items-center gap-1.5">
                                {td(vm.priority.label)} {td("priority")}
                            </span>
                        </div>

                        {/* Due pill — red once overdue */}
                        <span
                            className="inline-flex items-center gap-1.5 whitespace-nowrap"
                            style={{
                                marginTop: 10,
                                padding: "4px 11px",
                                borderRadius: 999,
                                fontSize: 14,
                                fontWeight: 600,
                                lineHeight: 1.5,
                                background:
                                    vm.bucket === "overdue"
                                        ? T.RED_SOFT
                                        : vm.dueBg,
                                color: vm.dueColor,
                                border: `1px solid ${
                                    vm.bucket === "overdue"
                                        ? T.RED_MID
                                        : vm.dueBorder
                                }`,
                            }}
                        >
                            <TaskGlyph
                                d={TASK_ICON.calendar}
                                size={13}
                                strokeWidth={1.5}
                            />
                            {task.due_date ? (
                                <>
                                    {formatDateWithTime(task.due_date)}
                                    {" · "}
                                    {td(vm.dueSub, { source: "en" })}
                                </>
                            ) : (
                                // Undated tasks say so once — never "No due
                                // date · No due date", and never overdue.
                                td("No due date")
                            )}
                        </span>

                        <div
                            className="flex items-center gap-2"
                            style={{ marginTop: 12 }}
                        >
                            <MultiUserIndicator
                                users={vm.people.slice(0, 2).map((person) => ({
                                    id: person.id,
                                    name: person.name,
                                    image_url: person.image ?? undefined,
                                }))}
                                size="sm"
                                showNames={false}
                                showTooltip={false}
                                colorful
                            />
                            <span
                                style={{ fontSize: 14.5, color: T.TEXT_MUTED }}
                            >
                                {vm.people.length > 0 ? (
                                    <>
                                        {td("Assigned to")}{" "}
                                        {/* Name everyone rather than "+N" —
                                            the stack already shows the count,
                                            and the names are the useful part. */}
                                        <b
                                            style={{
                                                color: T.TEXT,
                                                fontWeight: 600,
                                            }}
                                            title={vm.people
                                                .map((person) => person.name)
                                                .join(", ")}
                                        >
                                            {vm.people
                                                .map((person) => person.name)
                                                .join(", ")}
                                        </b>
                                    </>
                                ) : (
                                    td("Unassigned")
                                )}
                                {assigner?.name &&
                                    ` · ${td("by")} ${assigner.name}`}
                            </span>
                        </div>
                    </div>

                    <div
                        className="min-h-0 flex-1 overflow-y-auto"
                        style={{ padding: "20px 22px" }}
                    >
                        {vm.links.length > 0 && (
                            <div style={{ marginBottom: 22 }}>
                                {vm.links.map((link) => {
                                    const body = (
                                        <>
                                            <span
                                                className="flex flex-shrink-0 items-center justify-center"
                                                style={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: 6,
                                                    background: link.iconBg,
                                                    color: link.iconFg,
                                                }}
                                            >
                                                <TaskRecordIcon
                                                    type={link.type}
                                                    size={15}
                                                    color={link.iconFg}
                                                />
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 15.5,
                                                    fontWeight: 600,
                                                    color: T.TEXT,
                                                }}
                                            >
                                                {link.name}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 14.5,
                                                    color: T.TEXT_MUTED,
                                                }}
                                            >
                                                {td(link.typeLabel)}
                                            </span>
                                            {link.href && (
                                                <span
                                                    className="ml-auto flex"
                                                    style={{
                                                        color: T.TEXT_HINT,
                                                    }}
                                                >
                                                    <TaskGlyph
                                                        d={
                                                            TASK_ICON.externalLink
                                                        }
                                                        size={15}
                                                        strokeWidth={1.5}
                                                    />
                                                </span>
                                            )}
                                        </>
                                    );
                                    const style: React.CSSProperties = {
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        padding: "10px 12px",
                                        border: `1px solid ${T.BORDER}`,
                                        borderRadius: 10,
                                        marginBottom: 8,
                                        textDecoration: "none",
                                    };
                                    return link.href ? (
                                        <a
                                            key={`${link.type}-${link.name}`}
                                            href={link.href}
                                            className="tasks-record-row"
                                            style={style}
                                        >
                                            {body}
                                        </a>
                                    ) : (
                                        <div
                                            key={`${link.type}-${link.name}`}
                                            style={style}
                                        >
                                            {body}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <p style={{ ...LABEL, margin: "0 0 10px" }}>
                            {td("Description")}
                        </p>
                        <p
                            style={{
                                fontSize: 16,
                                lineHeight: 1.55,
                                margin: "0 0 20px",
                                color: vm.descriptionText
                                    ? T.TEXT_MUTED
                                    : T.TEXT_HINT,
                                fontStyle: vm.descriptionText
                                    ? "normal"
                                    : "italic",
                                whiteSpace: "pre-wrap",
                            }}
                        >
                            {vm.descriptionText ||
                                td("No description added yet.")}
                        </p>

                        <p
                            style={{
                                ...LABEL,
                                margin: "0 0 10px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}
                        >
                            {td("Checklist")}
                            <span
                                style={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: T.TEXT_MUTED,
                                    background: T.NAVY_SOFT,
                                    borderRadius: 999,
                                    padding: "1px 7px",
                                    textTransform: "none",
                                    letterSpacing: 0,
                                }}
                            >
                                {doneCount}/{checkpoints.items.length}
                            </span>
                        </p>

                        {checkpoints.items.map((item) => {
                            const done = item.status === "complete";
                            return (
                                <div
                                    key={item.id}
                                    className="tasks-checkpoint flex items-center gap-2.5"
                                    style={{
                                        padding: "7px 4px",
                                        borderRadius: 8,
                                    }}
                                >
                                    <button
                                        type="button"
                                        aria-label={item.title}
                                        aria-pressed={done}
                                        disabled={!canWrite}
                                        onClick={() => checkpoints.toggle(item)}
                                        className="flex flex-shrink-0 items-center justify-center"
                                        style={{
                                            width: 18,
                                            height: 18,
                                            padding: 0,
                                            borderRadius: 999,
                                            border: `1.5px solid ${done ? T.GREEN : T.NAVY_MID}`,
                                            background: done
                                                ? T.GREEN
                                                : T.WHITE,
                                            cursor: canWrite
                                                ? "pointer"
                                                : "default",
                                        }}
                                    >
                                        <TaskGlyph
                                            d={TASK_ICON.check}
                                            size={11}
                                            color={T.WHITE}
                                            strokeWidth={2.5}
                                        />
                                    </button>
                                    <span
                                        className="flex-1"
                                        style={{
                                            fontSize: 15.5,
                                            color: done ? T.TEXT_HINT : T.TEXT,
                                            textDecoration: done
                                                ? "line-through"
                                                : "none",
                                        }}
                                    >
                                        {item.title}
                                    </span>
                                    {canWrite && (
                                        <button
                                            type="button"
                                            aria-label={`${td("Remove")} ${item.title}`}
                                            onClick={() =>
                                                checkpoints.remove(item.id)
                                            }
                                            className="tasks-checkpoint-remove"
                                            style={{
                                                display: "flex",
                                                padding: 4,
                                                border: "none",
                                                background: "transparent",
                                                color: T.TEXT_HINT,
                                                cursor: "pointer",
                                            }}
                                        >
                                            <TaskGlyph
                                                d={TASK_ICON.x}
                                                size={14}
                                                strokeWidth={1.5}
                                            />
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        {canWrite && (
                            <div
                                className="flex items-center gap-2.5"
                                style={{
                                    padding: "7px 4px",
                                    color: T.TEXT_HINT,
                                }}
                            >
                                <TaskGlyph
                                    d={TASK_ICON.plus}
                                    size={15}
                                    strokeWidth={1.5}
                                />
                                <input
                                    value={newCheckpoint}
                                    disabled={checkpoints.saving}
                                    placeholder={td("Add a checklist item")}
                                    onChange={(event) =>
                                        setNewCheckpoint(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                        if (
                                            event.key === "Enter" &&
                                            newCheckpoint.trim()
                                        ) {
                                            event.preventDefault();
                                            void checkpoints
                                                .add(newCheckpoint.trim())
                                                .then(() =>
                                                    setNewCheckpoint(""),
                                                );
                                        }
                                    }}
                                    style={{
                                        flex: 1,
                                        border: "none",
                                        outline: "none",
                                        fontSize: 15.5,
                                        color: T.TEXT,
                                        background: "transparent",
                                        fontFamily: "inherit",
                                    }}
                                />
                            </div>
                        )}

                        {checkpoints.error && (
                            <p style={{ fontSize: 14, color: T.RED }}>
                                {checkpoints.error}
                            </p>
                        )}
                    </div>

                    <div
                        className="flex flex-shrink-0 items-center justify-between"
                        style={{
                            padding: "14px 22px",
                            borderTop: `1px solid ${T.BORDER_SOFT}`,
                            background: T.WHITE,
                        }}
                    >
                        {canWrite ? (
                            <button
                                type="button"
                                onClick={onEdit}
                                className="tasks-press inline-flex items-center gap-1.5"
                                style={{
                                    padding: "9px 16px",
                                    borderRadius: 8,
                                    background: T.WHITE,
                                    color: T.TEXT_MUTED,
                                    border: `1px solid ${T.BORDER}`,
                                    fontSize: 15,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                <TaskGlyph
                                    d={TASK_ICON.edit}
                                    size={15}
                                    strokeWidth={1.5}
                                />
                                {td("Edit task")}
                            </button>
                        ) : (
                            <span />
                        )}

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="tasks-press"
                                style={{
                                    padding: "9px 16px",
                                    borderRadius: 8,
                                    background: T.WHITE,
                                    color: T.TEXT_MUTED,
                                    border: `1px solid ${T.BORDER}`,
                                    fontSize: 15,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                {td("Close")}
                            </button>
                            {canWrite && (
                                <button
                                    type="button"
                                    onClick={onToggleDone}
                                    disabled={toggling}
                                    className="tasks-press inline-flex items-center gap-1.5"
                                    style={{
                                        padding: "9px 16px",
                                        borderRadius: 8,
                                        background: T.BLUE,
                                        color: T.WHITE,
                                        border: `1px solid ${T.BLUE}`,
                                        fontSize: 15,
                                        fontWeight: 600,
                                        cursor: toggling
                                            ? "default"
                                            : "pointer",
                                        opacity: toggling ? 0.7 : 1,
                                    }}
                                >
                                    <TaskGlyph
                                        d={TASK_ICON.check}
                                        size={15}
                                        strokeWidth={1.5}
                                    />
                                    {vm.done
                                        ? td("Reopen task")
                                        : td("Mark done")}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Comments rail ────────────────────────────── */}
                <TaskCommentsPanel
                    comments={comments.comments}
                    loading={comments.loading}
                    posting={comments.posting}
                    error={comments.error}
                    people={people}
                    currentUser={currentUser}
                    canComment={canWrite}
                    onSubmit={comments.addComment}
                    onDelete={comments.deleteComment}
                />
            </div>
        </div>,
        document.body,
    );
}
