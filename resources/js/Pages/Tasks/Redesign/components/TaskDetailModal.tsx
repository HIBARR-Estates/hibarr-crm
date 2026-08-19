import { createPortal } from "react-dom";
import { useEffect } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { formatDateWithTime } from "@/Components/Redesign/adapters/dateFormat";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import { TASK_ICON } from "../config/taskDesignTokens";
import type { TaskViewModel } from "../adapters/taskViewModel";
import {
    TaskCategoryTag,
    TaskGlyph,
    TaskStatusPill,
} from "./primitives/TaskGlyphs";

interface TaskDetailModalProps {
    vm: TaskViewModel | null;
    onClose: () => void;
    onEdit: () => void;
    onToggleDone: () => void;
    canWrite: boolean;
    toggling: boolean;
}

const LABEL_STYLE: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: T.TEXT_MUTED,
};

/**
 * Task detail dialog, laid out per the handoff: chip row, description,
 * linked records, a three-up date grid, assignees, and the checklist.
 * Built directly rather than via the shared `Modal` primitive because the
 * design's header carries the status/priority/due chip row.
 */
export default function TaskDetailModal({
    vm,
    onClose,
    onEdit,
    onToggleDone,
    canWrite,
    toggling,
}: TaskDetailModalProps) {
    const { td } = useTd();

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

    if (!vm || typeof document === "undefined") return null;

    const task = vm.task;
    const subtasks = task.subtasks ?? [];
    const doneCount = subtasks.filter(
        (item) => item.status === "complete",
    ).length;
    const assigner = task.created_by ?? task.assigner;

    const dates = [
        {
            label: "Due",
            value: task.due_date ? formatDateWithTime(task.due_date) : "—",
            note: vm.dueSub,
            fg: vm.dueColor,
            noteFg: vm.dueColor,
            weight: 700,
        },
        {
            label: "Created",
            value: task.created_at ? formatDateWithTime(task.created_at) : "—",
            note: assigner?.name ? `by ${assigner.name}` : "",
            fg: T.TEXT,
            noteFg: T.TEXT_HINT,
            weight: 600,
        },
        {
            label: "Last update",
            value: task.updated_at ? formatDateWithTime(task.updated_at) : "—",
            note: "",
            fg: T.TEXT,
            noteFg: T.TEXT_HINT,
            weight: 600,
        },
    ];

    return createPortal(
        <div
            className="redesign-modal-overlay"
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
                className="flex w-full flex-col overflow-hidden"
                style={{
                    maxWidth: 640,
                    maxHeight: "88vh",
                    background: T.WHITE,
                    borderRadius: 14,
                    boxShadow: "0 20px 50px rgba(22,41,77,0.18)",
                }}
            >
                {/* Header */}
                <div
                    className="flex items-start justify-between gap-4"
                    style={{
                        padding: "16px 22px",
                        background: T.SURFACE_2,
                        borderBottom: `1px solid ${T.BORDER}`,
                    }}
                >
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <span style={LABEL_STYLE}>{td("Task detail")}</span>
                        <h2
                            className="m-0"
                            style={{
                                fontSize: 17,
                                fontWeight: 700,
                                color: T.NAVY,
                                lineHeight: 1.35,
                                textWrap: "pretty",
                                textDecoration: vm.titleDecoration,
                            }}
                        >
                            {vm.title}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <TaskStatusPill status={vm.status} />
                            <TaskCategoryTag category={vm.category} />
                            <span style={{ color: T.NAVY_MID }}>|</span>
                            <span
                                className="inline-flex items-center gap-1.5"
                                style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: vm.priority.fg,
                                }}
                            >
                                <TaskGlyph
                                    d={vm.priority.d}
                                    size={13}
                                    color={vm.priority.color}
                                />
                                {td(vm.priority.label)} {td("priority")}
                            </span>
                            <span style={{ color: T.NAVY_MID }}>|</span>
                            <span
                                className="inline-flex items-center gap-1.5"
                                style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: vm.dueColor,
                                }}
                            >
                                <TaskGlyph
                                    d={TASK_ICON.calendar}
                                    size={12}
                                    strokeWidth={1.5}
                                />
                                {td(vm.dueText, { source: "en" })}
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-label={td("Close")}
                        onClick={onClose}
                        style={{
                            display: "flex",
                            padding: 2,
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                        }}
                    >
                        <TaskGlyph
                            d={TASK_ICON.x}
                            size={17}
                            color={T.TEXT_MUTED}
                            strokeWidth={1.5}
                        />
                    </button>
                </div>

                {/* Body */}
                <div
                    className="flex flex-col gap-4 overflow-y-auto"
                    style={{ padding: "20px 22px" }}
                >
                    <p
                        className="m-0"
                        style={{
                            fontSize: 14,
                            lineHeight: 1.55,
                            color: vm.descriptionText ? T.TEXT_MUTED : T.TEXT_HINT,
                            fontStyle: vm.descriptionText ? "normal" : "italic",
                            textWrap: "pretty",
                            whiteSpace: "pre-wrap",
                        }}
                    >
                        {vm.descriptionText || td("No description")}
                    </p>

                    <div
                        className="flex flex-col gap-3.5"
                        style={{
                            padding: "16px 0",
                            borderTop: `1px solid ${T.BORDER_SOFT}`,
                            borderBottom: `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        {/* Linked records */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-baseline justify-between gap-3">
                                <span style={LABEL_STYLE}>
                                    {td("Linked records")}
                                </span>
                                <span
                                    style={{ fontSize: 12, color: T.TEXT_HINT }}
                                >
                                    {vm.links.length + vm.extraLinks}{" "}
                                    {vm.links.length + vm.extraLinks === 1
                                        ? td("record")
                                        : td("records")}
                                </span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {[...vm.links].length === 0 && (
                                    <span
                                        style={{
                                            fontSize: 13,
                                            color: T.TEXT_HINT,
                                            fontStyle: "italic",
                                        }}
                                    >
                                        {td("No linked records")}
                                    </span>
                                )}
                                {vm.links.map((link) => {
                                    const body = (
                                        <>
                                            <span
                                                className="flex flex-shrink-0 items-center justify-center"
                                                style={{
                                                    width: 30,
                                                    height: 30,
                                                    borderRadius: 8,
                                                    background: link.iconBg,
                                                }}
                                            >
                                                <TaskGlyph
                                                    d={link.d}
                                                    size={15}
                                                    color={link.iconFg}
                                                    strokeWidth={1.5}
                                                />
                                            </span>
                                            <span className="flex min-w-0 flex-1 flex-col gap-px">
                                                <span style={LABEL_STYLE}>
                                                    {td(link.typeLabel)}
                                                </span>
                                                <span
                                                    className="truncate"
                                                    style={{
                                                        fontSize: 14,
                                                        fontWeight: 600,
                                                        color: T.TEXT,
                                                    }}
                                                >
                                                    {link.name}
                                                </span>
                                            </span>
                                            {link.href && (
                                                <TaskGlyph
                                                    d={TASK_ICON.externalLink}
                                                    size={14}
                                                    color={T.BLUE}
                                                    strokeWidth={1.5}
                                                />
                                            )}
                                        </>
                                    );
                                    const style: React.CSSProperties = {
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        padding: "9px 12px",
                                        border: `1px solid ${T.BORDER}`,
                                        borderLeft: `3px solid ${link.iconFg}`,
                                        borderRadius: 10,
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
                        </div>

                        {/* Dates */}
                        <div
                            className="grid"
                            style={{
                                gridTemplateColumns: "repeat(3, 1fr)",
                                border: `1px solid ${T.BORDER}`,
                                borderRadius: 10,
                                overflow: "hidden",
                            }}
                        >
                            {dates.map((date, index) => (
                                <div
                                    key={date.label}
                                    className="flex min-w-0 flex-col gap-1.5"
                                    style={{
                                        padding: "12px 14px",
                                        borderRight:
                                            index < dates.length - 1
                                                ? `1px solid ${T.BORDER_SOFT}`
                                                : "none",
                                    }}
                                >
                                    <span style={LABEL_STYLE}>
                                        {td(date.label)}
                                    </span>
                                    <span
                                        className="truncate"
                                        style={{
                                            fontSize: 14,
                                            fontWeight: date.weight,
                                            color: date.fg,
                                        }}
                                    >
                                        {date.value}
                                    </span>
                                    {date.note && (
                                        <span
                                            className="truncate"
                                            style={{
                                                fontSize: 12,
                                                color: date.noteFg,
                                            }}
                                        >
                                            {td(date.note, { source: "en" })}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* People */}
                        <div className="flex flex-wrap items-center gap-7">
                            <div className="flex min-w-0 items-center gap-3">
                                <span style={LABEL_STYLE}>
                                    {td("Assigned to")}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    {vm.people.length === 0 ? (
                                        <span
                                            style={{
                                                fontSize: 13,
                                                color: T.TEXT_HINT,
                                                fontStyle: "italic",
                                            }}
                                        >
                                            {td("Unassigned")}
                                        </span>
                                    ) : (
                                        vm.people.map((person) => (
                                            <span
                                                key={person.id}
                                                title={person.name}
                                            >
                                                <Avatar
                                                    size={28}
                                                    initials={person.initials}
                                                />
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>
                            {assigner?.name && (
                                <div className="flex min-w-0 items-center gap-3">
                                    <span style={LABEL_STYLE}>
                                        {td("Assigned by")}
                                    </span>
                                    <span title={assigner.name}>
                                        <Avatar
                                            size={28}
                                            type="watcher"
                                            initials={initialsFromName(
                                                assigner.name,
                                            )}
                                        />
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Checklist */}
                    {subtasks.length > 0 && (
                        <div>
                            <div className="mb-2.5 flex items-center justify-between">
                                <span style={LABEL_STYLE}>
                                    {td("Checklist")}
                                </span>
                                <span
                                    style={{ fontSize: 12, color: T.TEXT_HINT }}
                                >
                                    {doneCount}/{subtasks.length}
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                {subtasks.map((item) => {
                                    const complete = item.status === "complete";
                                    return (
                                        <div
                                            key={item.id}
                                            className="flex items-center gap-2.5"
                                        >
                                            <span
                                                className="flex flex-shrink-0 items-center justify-center"
                                                style={{
                                                    width: 16,
                                                    height: 16,
                                                    borderRadius: 999,
                                                    border: `1.5px solid ${complete ? "#177a5b" : "#c7d0de"}`,
                                                    background: complete
                                                        ? "#177a5b"
                                                        : T.WHITE,
                                                }}
                                            >
                                                <TaskGlyph
                                                    d={TASK_ICON.check}
                                                    size={10}
                                                    color={T.WHITE}
                                                    strokeWidth={2.5}
                                                />
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 14,
                                                    color: complete
                                                        ? T.TEXT_HINT
                                                        : T.TEXT,
                                                    textDecoration: complete
                                                        ? "line-through"
                                                        : "none",
                                                }}
                                            >
                                                {item.title}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div
                    className="flex items-center justify-between gap-2.5"
                    style={{
                        padding: "14px 22px",
                        borderTop: `1px solid ${T.BORDER}`,
                        background: T.WHITE,
                    }}
                >
                    {canWrite ? (
                        <button
                            type="button"
                            onClick={onEdit}
                            className="inline-flex items-center gap-1.5"
                            style={{
                                padding: "9px 14px",
                                borderRadius: 8,
                                background: T.WHITE,
                                color: T.TEXT_MUTED,
                                border: `1px solid ${T.BORDER}`,
                                fontSize: 13,
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

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: "9px 16px",
                                borderRadius: 8,
                                background: T.WHITE,
                                color: T.TEXT_MUTED,
                                border: `1px solid ${T.BORDER}`,
                                fontSize: 13,
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
                                className="inline-flex items-center gap-1.5"
                                style={{
                                    padding: "9px 16px",
                                    borderRadius: 8,
                                    background: T.BLUE,
                                    color: T.WHITE,
                                    border: `1px solid ${T.BLUE}`,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: toggling ? "default" : "pointer",
                                    opacity: toggling ? 0.7 : 1,
                                }}
                            >
                                <TaskGlyph
                                    d={TASK_ICON.check}
                                    size={15}
                                    strokeWidth={1.5}
                                />
                                {vm.done ? td("Reopen task") : td("Mark done")}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}
