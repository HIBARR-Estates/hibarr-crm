import type { DragEvent } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import MultiUserIndicator from "@/Components/MultiUserIndicator";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { TASK_ICON } from "../../config/taskDesignTokens";
import type { TaskViewModel } from "../../adapters/taskViewModel";
import { TaskGlyph, TaskPriorityInline } from "../primitives/TaskGlyphs";
import TaskRecordIcon from "../primitives/TaskRecordIcon";
import TaskRowMenu, { type TaskRowAction } from "../primitives/TaskRowMenu";

export interface TaskBoardCardProps {
    vm: TaskViewModel;
    /** "full" shows the blurb + linked-record lines; "minimal" hides them. */
    cardMeta: "full" | "minimal";
    draggable: boolean;
    dragging: boolean;
    onOpen: () => void;
    onDragStart: (event: DragEvent<HTMLDivElement>) => void;
    onDragEnd: () => void;
    /** Row menu ("…") actions — same set the list view uses for this task. */
    actions: TaskRowAction[];
}

/**
 * One Kanban card: assignee + row menu, title, blurb, linked records, then
 * a due/priority footer. Reused by TaskBoardColumn; kept free of drag/board
 * state so it stays usable anywhere a single task needs this exact look
 * (e.g. a future "linked tasks" list on a deal/lead).
 */
export default function TaskBoardCard({
    vm,
    cardMeta,
    draggable,
    dragging,
    onOpen,
    onDragStart,
    onDragEnd,
    actions,
}: TaskBoardCardProps) {
    const { td } = useTd();
    const full = cardMeta === "full";
    // Cards without a description are shorter — 176 leaves room for a
    // 3-line clamped blurb; without one, 136 fits title + links/footer.
    const minHeight = full && vm.blurb ? 176 : 136;

    return (
        <div
            draggable={draggable}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen();
                }
            }}
            className="tasks-board-card flex min-w-0 flex-none flex-col gap-3"
            style={{
                overflow: "hidden",
                border: `1px solid ${T.BORDER}`,
                borderRadius: 10,
                background: T.SURFACE,
                padding: "15px 15px 14px",
                cursor: draggable ? "grab" : "pointer",
                minHeight,
                opacity: dragging ? 0.45 : 1,
                boxShadow: dragging
                    ? "0 8px 20px rgba(22,41,77,0.14)"
                    : "none",
            }}
        >
            <div className="flex items-center gap-2.5">
                <div className="flex flex-shrink-0">
                    <MultiUserIndicator
                        users={vm.people.slice(0, 3).map((person) => ({
                            id: person.id,
                            name: person.name,
                            image_url: person.image ?? undefined,
                        }))}
                        size="sm"
                        showNames={false}
                        colorful
                    />
                </div>
                <span
                    className="min-w-0 flex-1 truncate"
                    style={{
                        fontSize: 14,
                        color: T.TEXT_MUTED,
                        paddingLeft: 5,
                    }}
                >
                    {vm.people.length === 0 ? td("Unassigned") : vm.peopleLabel}
                </span>
                <TaskRowMenu actions={actions} ariaLabel={td("Task actions")} />
            </div>

            <span
                className="tasks-clamp-2"
                style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: T.NAVY,
                    lineHeight: 1.35,
                    textDecoration: vm.titleDecoration,
                }}
            >
                {vm.title}
            </span>

            {full && vm.blurb && (
                <span
                    className="tasks-clamp-3 flex-1"
                    style={{
                        fontSize: 15,
                        color: T.TEXT_MUTED,
                        lineHeight: 1.45,
                    }}
                >
                    {vm.blurb}
                </span>
            )}

            {full && (
                <div
                    className="flex min-w-0 flex-col gap-1"
                    style={{ marginTop: "auto" }}
                >
                    {vm.links.map((link) => {
                        const body = (
                            <>
                                <TaskRecordIcon
                                    type={link.type}
                                    size={13}
                                    color={link.iconFg}
                                />
                                <span
                                    className="truncate"
                                    style={{
                                        fontSize: 14,
                                        color: T.TEXT_MUTED,
                                    }}
                                >
                                    {td(link.typeLabel)} · {link.name}
                                </span>
                            </>
                        );
                        // Opens the record itself rather than the card's
                        // task modal.
                        return link.href ? (
                            <a
                                key={`${link.type}-${link.name}`}
                                href={link.href}
                                draggable={false}
                                onClick={(event) => event.stopPropagation()}
                                className="tasks-entity-link flex min-w-0 items-center gap-1.5"
                            >
                                {body}
                            </a>
                        ) : (
                            <div
                                key={`${link.type}-${link.name}`}
                                className="flex min-w-0 items-center gap-1.5"
                            >
                                {body}
                            </div>
                        );
                    })}
                    {vm.extraLinks > 0 && (
                        <span
                            style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: T.BLUE,
                                paddingLeft: 20,
                            }}
                        >
                            +{vm.extraLinks} {td("more linked")}
                        </span>
                    )}
                </div>
            )}

            <div className="flex min-w-0 items-center justify-between gap-2.5 pt-0.5">
                <span
                    className="inline-flex min-w-0 items-center gap-1.5 truncate whitespace-nowrap"
                    style={{ fontSize: 14, color: vm.dueColor }}
                >
                    <TaskGlyph
                        d={TASK_ICON.calendar}
                        size={13}
                        strokeWidth={1.5}
                    />
                    {td(vm.dueText, { source: "en" })}
                </span>
                <TaskPriorityInline priority={vm.priority} />
            </div>
        </div>
    );
}
