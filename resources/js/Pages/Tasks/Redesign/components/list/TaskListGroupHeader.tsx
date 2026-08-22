import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import SelectCheckbox from "@/Components/Redesign/primitives/SelectCheckbox";
import { TASK_ICON } from "../../config/taskDesignTokens";
import { TaskGlyph } from "../primitives/TaskGlyphs";
import type { TaskViewModel } from "../../adapters/taskViewModel";
import type { TaskGroup } from "./types";

interface TaskListGroupHeaderProps {
    group: TaskGroup;
    open: boolean;
    selected: Set<number>;
    onToggleOpen: () => void;
    onToggleGroup: (tasks: TaskViewModel[], select: boolean) => void;
}

export default function TaskListGroupHeader({
    group,
    open,
    selected,
    onToggleOpen,
    onToggleGroup,
}: TaskListGroupHeaderProps) {
    const { td } = useTd();
    const allSelected =
        group.tasks.length > 0 &&
        group.tasks.every((vm) => selected.has(vm.id));

    return (
        <div
            className="tasks-group-header flex w-full select-none items-center gap-2.5 text-left"
            style={{
                padding: "11px 18px",
                borderTop: `1px solid ${T.BORDER_SOFT}`,
                borderBottom: `1px solid ${T.BORDER_SOFT}`,
            }}
        >
            <SelectCheckbox
                checked={allSelected}
                onChange={() => onToggleGroup(group.tasks, !allSelected)}
                label={`${td("Select all in")} ${group.label}`}
            />
            <button
                type="button"
                onClick={onToggleOpen}
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
                        transform: open ? "rotate(0deg)" : "rotate(-90deg)",
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
    );
}
