import { useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import MultiUserIndicator from "@/Components/MultiUserIndicator";
import TaskStatusSelect from "./primitives/TaskStatusSelect";
import {
    ROW_PADDING,
    TASK_ICON,
    type DensityOption,
} from "../config/taskDesignTokens";
import type { TaskViewModel } from "../adapters/taskViewModel";
import SelectCheckbox from "@/Components/Redesign/primitives/SelectCheckbox";
import {
    TaskCategoryTag,
    TaskGlyph,
    TaskPriorityPill,
    TaskPriorityStripe,
} from "./primitives/TaskGlyphs";
import TaskRowMenu, { type TaskRowAction } from "./primitives/TaskRowMenu";
import TaskRecordIcon from "./primitives/TaskRecordIcon";

export interface TaskGroup {
    key: string;
    label: string;
    dot: string;
    fg: string;
    tasks: TaskViewModel[];
    /**
     * The group's size across the whole result set. Set when a group is split
     * across pages, so the header shows the true total rather than the number
     * of rows on this page.
     */
    totalCount?: number;
}

interface TasksListViewProps {
    groups: TaskGroup[];
    columns: TaskboardColumn[];
    density: DensityOption;
    priorityTreatment: "stripe" | "pill";
    showRowCategory: boolean;
    onOpen: (vm: TaskViewModel) => void;
    onStatusChange: (vm: TaskViewModel, slug: string, columnId: number) => void;
    isStatusPending: (taskId: number) => boolean;
    rowActions: (vm: TaskViewModel) => TaskRowAction[];
    /** Ids currently selected for bulk actions. */
    selected: Set<number>;
    onToggleSelect: (vm: TaskViewModel) => void;
    /** Selects/clears every task in one group's header checkbox. */
    onToggleGroup: (tasks: TaskViewModel[], select: boolean) => void;
}

export default function TasksListView({
    groups,
    columns,
    density,
    priorityTreatment,
    showRowCategory,
    onOpen,
    onStatusChange,
    isStatusPending,
    rowActions,
    selected,
    onToggleSelect,
    onToggleGroup,
}: TasksListViewProps) {
    const { td } = useTd();
    const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
    const rowPad = ROW_PADDING[density];

    const toggleGroup = (key: string) =>
        setCollapsed((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    if (groups.length === 0) {
        return (
            <div
                className="flex flex-col items-center gap-2 text-center"
                style={{ padding: "40px 20px" }}
            >
                <TaskGlyph
                    d={TASK_ICON.inboxEmpty}
                    size={24}
                    color={T.NAVY_MID}
                    strokeWidth={1.5}
                />
                <span
                    style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: T.TEXT_MUTED,
                    }}
                >
                    {td("No tasks match these filters")}
                </span>
                <span style={{ fontSize: 14, color: T.TEXT_HINT }}>
                    {td("Try clearing a filter or adding a new task.")}
                </span>
            </div>
        );
    }

    return (
        <div className="tasks-list-body">
            {groups.map((group) => {
                const open = !collapsed.has(group.key);
                return (
                    <section key={group.key}>
                        <div
                            className="tasks-group-header flex w-full select-none items-center gap-2.5 text-left"
                            style={{
                                padding: "11px 18px",
                                borderTop: `1px solid ${T.BORDER_SOFT}`,
                                borderBottom: `1px solid ${T.BORDER_SOFT}`,
                            }}
                        >
                            {/* Selects every row in this group. */}
                            <SelectCheckbox
                                checked={
                                    group.tasks.length > 0 &&
                                    group.tasks.every((vm) =>
                                        selected.has(vm.id),
                                    )
                                }
                                onChange={() =>
                                    onToggleGroup(
                                        group.tasks,
                                        !group.tasks.every((vm) =>
                                            selected.has(vm.id),
                                        ),
                                    )
                                }
                                label={`${td("Select all in")} ${group.label}`}
                            />
                            <button
                                type="button"
                                onClick={() => toggleGroup(group.key)}
                                aria-expanded={open}
                                className="flex flex-1 cursor-pointer items-center gap-2.5 text-left"
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    padding: 0,
                                }}
                            >
                                <span
                                    style={{
                                        display: "flex",
                                        transform: open
                                            ? "rotate(0deg)"
                                            : "rotate(-90deg)",
                                        transition: "transform 140ms ease",
                                    }}
                                >
                                    <TaskGlyph
                                        d={TASK_ICON.chevron}
                                        size={13}
                                        color={T.TEXT_HINT}
                                    />
                                </span>
                                <span
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: 999,
                                        background: group.dot,
                                    }}
                                />
                                <span
                                    className="uppercase"
                                    style={{
                                        fontSize: 14,
                                        fontWeight: 700,
                                        letterSpacing: "0.05em",
                                        color: group.fg,
                                    }}
                                >
                                    {td(group.label, { source: "en" })}
                                </span>
                                <span
                                    style={{
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: T.TEXT_HINT,
                                    }}
                                >
                                    {group.totalCount ?? group.tasks.length}
                                </span>
                            </button>
                        </div>

                        {open &&
                            group.tasks.map((vm, rowIndex) => (
                                <div
                                    key={vm.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => onOpen(vm)}
                                    onKeyDown={(event) => {
                                        if (
                                            event.key === "Enter" ||
                                            event.key === " "
                                        ) {
                                            event.preventDefault();
                                            onOpen(vm);
                                        }
                                    }}
                                    className={`tasks-row flex cursor-pointer items-center gap-3${
                                        rowIndex % 2 !== 0
                                            ? " tasks-row-stripe"
                                            : ""
                                    }`}
                                    style={{
                                        padding: `${rowPad} 18px`,
                                        borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                    }}
                                >
                                    <SelectCheckbox
                                        checked={selected.has(vm.id)}
                                        onChange={() => onToggleSelect(vm)}
                                        label={`${td("Select")} — ${vm.title}`}
                                    />

                                    {priorityTreatment === "stripe" && (
                                        <TaskPriorityStripe
                                            priority={vm.priority}
                                        />
                                    )}

                                    <div
                                        className="flex flex-1 flex-col gap-0.5"
                                        style={{ minWidth: 220 }}
                                    >
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span
                                                className="truncate"
                                                style={{
                                                    fontSize: 16,
                                                    fontWeight: 600,
                                                    color: vm.titleColor,
                                                    textDecoration:
                                                        vm.titleDecoration,
                                                }}
                                            >
                                                {vm.title}
                                            </span>
                                            {priorityTreatment === "pill" && (
                                                <TaskPriorityPill
                                                    priority={vm.priority}
                                                />
                                            )}
                                        </div>

                                        <div
                                            className="flex min-w-0 items-center gap-2"
                                            style={{
                                                fontSize: 14,
                                                color: T.TEXT_MUTED,
                                            }}
                                        >
                                            {showRowCategory && vm.category && (
                                                <>
                                                    <TaskCategoryTag
                                                        category={vm.category}
                                                    />
                                                    {(vm.links.length > 0 ||
                                                        vm.extraLinks > 0) && (
                                                        <span
                                                            style={{
                                                                color: T.NAVY_MID,
                                                                flexShrink: 0,
                                                            }}
                                                        >
                                                            |
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                            {vm.links.map((link) => {
                                                const body = (
                                                    <>
                                                        <TaskRecordIcon
                                                            type={link.type}
                                                            size={13}
                                                            color={link.iconFg}
                                                        />
                                                        <span className="truncate">
                                                            {link.name}
                                                        </span>
                                                    </>
                                                );
                                                // Clicking a linked record
                                                // opens that record, not the
                                                // task — so stop the row's
                                                // own open handler.
                                                return link.href ? (
                                                    <a
                                                        key={`${link.type}-${link.name}`}
                                                        href={link.href}
                                                        onClick={(event) =>
                                                            event.stopPropagation()
                                                        }
                                                        className="tasks-entity-link inline-flex min-w-0 items-center gap-1.5"
                                                        style={{
                                                            color: T.TEXT_MUTED,
                                                        }}
                                                    >
                                                        {body}
                                                    </a>
                                                ) : (
                                                    <span
                                                        key={`${link.type}-${link.name}`}
                                                        className="inline-flex min-w-0 items-center gap-1.5"
                                                    >
                                                        {body}
                                                    </span>
                                                );
                                            })}
                                            {vm.extraLinks > 0 && (
                                                <span
                                                    style={{
                                                        fontWeight: 600,
                                                        color: T.BLUE,
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    +{vm.extraLinks}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Wide enough for a 12-hour stamp, e.g.
                                        "Yesterday · 11:00 AM". */}
                                    <div
                                        className="flex flex-shrink-0 flex-col gap-0.5 text-right"
                                        style={{ width: 152 }}
                                    >
                                        <span
                                            className="truncate"
                                            style={{
                                                fontSize: 14,
                                                fontWeight: 600,
                                                fontVariantNumeric:
                                                    "tabular-nums",
                                                color: vm.dueColor,
                                            }}
                                        >
                                            {td(vm.dueText, { source: "en" })}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 14,
                                                color: T.TEXT_HINT,
                                            }}
                                        >
                                            {td(vm.dueSub, { source: "en" })}
                                        </span>
                                    </div>

                                    <div
                                        className="flex flex-shrink-0 justify-end"
                                        style={{ width: 56 }}
                                    >
                                        <MultiUserIndicator
                                            users={vm.people.map((person) => ({
                                                id: person.id,
                                                name: person.name,
                                                image_url: person.image ?? undefined,
                                            }))}
                                            size="sm"
                                            maxCount={2}
                                            showNames={false}
                                            colorful
                                        />
                                    </div>

                                    <div
                                        className="flex flex-shrink-0 justify-end"
                                        style={{ width: 124 }}
                                        onClick={(event) =>
                                            event.stopPropagation()
                                        }
                                    >
                                        <TaskStatusSelect
                                            status={vm.statusSlug}
                                            columns={columns}
                                            loading={isStatusPending(vm.id)}
                                            onChange={(slug, columnId) =>
                                                onStatusChange(
                                                    vm,
                                                    slug,
                                                    columnId,
                                                )
                                            }
                                        />
                                    </div>

                                    <TaskRowMenu
                                        actions={rowActions(vm)}
                                        ariaLabel={`${td("Actions for")} ${vm.title}`}
                                    />
                                </div>
                            ))}
                    </section>
                );
            })}
        </div>
    );
}
