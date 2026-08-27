import type { MouseEvent, RefObject } from "react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { useTd } from "@/Hooks/useDynamicTranslation";
import {
    TASK_ICON,
    TASK_PRIORITY,
    TASK_PRIORITY_ORDER,
    categoryToken,
    statusToken,
    type TaskPriorityKey,
} from "../../config/taskDesignTokens";
import type { TaskFormValues } from "../../adapters/taskFormValues";
import { TaskGlyph } from "../primitives/TaskGlyphs";
import TaskPillSelect, { type PillOption } from "../primitives/TaskPillSelect";
import TaskDateSelect from "../primitives/TaskDateSelect";

interface CategoryOption {
    id: number;
    category_name: string;
}

interface TaskFormPillsProps {
    form: TaskFormValues;
    onChange: (patch: Partial<TaskFormValues>) => void;
    columns: TaskboardColumn[];
    categories: CategoryOption[];
    saving: boolean;
    dateRangeError: string | null;
    assigneeLabel: string;
    assigneeTriggerRef: RefObject<HTMLButtonElement | null>;
    linksTriggerRef: RefObject<HTMLButtonElement | null>;
    onToggleAssignee: (event: MouseEvent<HTMLElement>) => void;
    onToggleLinks: (event: MouseEvent<HTMLElement>) => void;
}

/** One pill dropdown per field, matching the list-view chrome. */
export default function TaskFormPills({
    form,
    onChange,
    columns,
    categories,
    saving,
    dateRangeError,
    assigneeLabel,
    assigneeTriggerRef,
    linksTriggerRef,
    onToggleAssignee,
    onToggleLinks,
}: TaskFormPillsProps) {
    const { td } = useTd();

    const statusOptions: PillOption[] = columns
        .slice()
        .sort((a, b) => a.priority - b.priority)
        .map((column) => {
            const token = statusToken(column.slug);
            return {
                value: String(column.id),
                label: column.column_name,
                bg: token.bg,
                fg: token.fg,
                border: token.border,
                dot: token.dot,
            };
        });

    const priorityOptions: PillOption[] = TASK_PRIORITY_ORDER.map((key) => {
        const token = TASK_PRIORITY[key];
        return {
            value: key,
            label: token.label,
            bg: token.bg,
            fg: token.fg,
            border: token.border,
            dot: token.color,
            d: token.d,
        };
    });

    const categoryOptions: PillOption[] = categories.flatMap((category) => {
        if (!category.category_name) return [];
        const token = categoryToken(category.category_name);
        if (!token) return [];
        return [
            {
                value: String(category.id),
                label: category.category_name,
                bg: token.bg,
                fg: token.fg,
                border: token.border,
                dot: token.dot,
                square: true,
            },
        ];
    });

    return (
        <div className="flex flex-wrap items-center gap-x-[7px] gap-y-2 pt-0.5">
            <TaskPillSelect
                value={
                    form.boardColumnId !== null
                        ? String(form.boardColumnId)
                        : null
                }
                options={statusOptions}
                placeholder={td("Status")}
                menuHeading={td("Move to")}
                disabled={saving}
                onChange={(value) =>
                    onChange({ boardColumnId: value ? Number(value) : null })
                }
            />

            <button
                ref={assigneeTriggerRef}
                type="button"
                onClick={onToggleAssignee}
                className="tasks-press inline-flex items-center gap-1.5 whitespace-nowrap"
                style={{
                    padding: "7px 13px",
                    borderRadius: 6,
                    fontSize: 15,
                    fontWeight: 600,
                    lineHeight: 1.5,
                    background: form.assignees.length
                        ? T.BLUE_LIGHT
                        : T.WHITE,
                    color: form.assignees.length
                        ? T.BLUE_DARK
                        : T.TEXT_MUTED,
                    border: `1px solid ${form.assignees.length ? T.BLUE_MID : T.BORDER}`,
                    cursor: "pointer",
                }}
            >
                <TaskGlyph d={TASK_ICON.user} size={13} strokeWidth={1.5} />
                {assigneeLabel}
                <span style={{ display: "flex", opacity: 0.6 }}>
                    <TaskGlyph
                        d={TASK_ICON.chevron}
                        size={11}
                        strokeWidth={1.5}
                    />
                </span>
            </button>

            <TaskDateSelect
                startDate={form.startDate}
                dueDate={form.dueDate}
                dueTime={form.dueTime}
                disabled={saving}
                error={dateRangeError}
                onChange={onChange}
            />

            <TaskPillSelect
                value={form.priority}
                options={priorityOptions}
                placeholder={td("Priority")}
                disabled={saving}
                onChange={(value) =>
                    onChange({
                        priority: (value as TaskPriorityKey) ?? "medium",
                    })
                }
            />

            <TaskPillSelect
                value={
                    form.categoryId !== null ? String(form.categoryId) : null
                }
                options={categoryOptions}
                placeholder={td("Category")}
                clearable
                columns={categoryOptions.length > 6 ? 2 : 1}
                menuWidth={categoryOptions.length > 6 ? 320 : 240}
                disabled={saving}
                onChange={(value) =>
                    onChange({ categoryId: value ? Number(value) : null })
                }
            />

            <button
                ref={linksTriggerRef}
                type="button"
                onClick={onToggleLinks}
                className="tasks-press inline-flex items-center gap-1.5 whitespace-nowrap"
                style={{
                    padding: "7px 13px",
                    borderRadius: 6,
                    fontSize: 15,
                    fontWeight: 600,
                    lineHeight: 1.5,
                    background: form.links.length ? T.BLUE_LIGHT : T.WHITE,
                    color: form.links.length ? T.BLUE_DARK : T.TEXT_MUTED,
                    border: `1px solid ${form.links.length ? T.BLUE_MID : T.BORDER}`,
                    cursor: "pointer",
                }}
            >
                <TaskGlyph
                    d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"
                    size={13}
                    strokeWidth={1.5}
                />
                {form.links.length
                    ? `${form.links.length} ${td("linked")}`
                    : td("Linked items")}
                <span style={{ display: "flex", opacity: 0.6 }}>
                    <TaskGlyph
                        d={TASK_ICON.chevron}
                        size={11}
                        strokeWidth={1.5}
                    />
                </span>
            </button>
        </div>
    );
}
