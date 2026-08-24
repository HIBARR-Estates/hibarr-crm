import { useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { ROW_PADDING, TASK_ICON, type DensityOption } from "../config/taskDesignTokens";
import type { TaskViewModel } from "../adapters/taskViewModel";
import { TaskGlyph } from "./primitives/TaskGlyphs";
import type { TaskRowAction } from "./primitives/TaskRowMenu";
import type { TaskGroup } from "./list/types";
import TaskListGroupHeader from "./list/TaskListGroupHeader";
import TaskListRow from "./list/TaskListRow";

export type { TaskGroup } from "./list/types";

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
    selected: Set<number>;
    onToggleSelect: (vm: TaskViewModel) => void;
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
                        <TaskListGroupHeader
                            group={group}
                            open={open}
                            selected={selected}
                            onToggleOpen={() => toggleGroup(group.key)}
                            onToggleGroup={onToggleGroup}
                        />
                        {open &&
                            group.tasks.map((vm, rowIndex) => (
                                <TaskListRow
                                    key={vm.id}
                                    vm={vm}
                                    striped={rowIndex % 2 !== 0}
                                    paddingY={rowPad}
                                    columns={columns}
                                    priorityTreatment={priorityTreatment}
                                    showRowCategory={showRowCategory}
                                    selected={selected.has(vm.id)}
                                    statusPending={isStatusPending(vm.id)}
                                    actions={rowActions(vm)}
                                    onOpen={() => onOpen(vm)}
                                    onToggleSelect={() => onToggleSelect(vm)}
                                    onStatusChange={(slug, columnId) =>
                                        onStatusChange(vm, slug, columnId)
                                    }
                                />
                            ))}
                    </section>
                );
            })}
        </div>
    );
}
