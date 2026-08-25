import MultiUserIndicator from "@/Components/MultiUserIndicator";
import { formatDateWithTime } from "@/Components/Redesign/adapters/dateFormat";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { TASK_ICON } from "../../config/taskDesignTokens";
import type { TaskViewModel } from "../../adapters/taskViewModel";
import { TaskGlyph, TaskPriorityStripe } from "../primitives/TaskGlyphs";

interface TaskDetailHeaderProps {
    vm: TaskViewModel;
}

export default function TaskDetailHeader({ vm }: TaskDetailHeaderProps) {
    const { td } = useTd();
    const task = vm.task;
    const assigner = task.created_by ?? task.assigner;

    return (
        <div
            className="flex-shrink-0"
            style={{
                padding: "16px 22px 14px",
                background: T.SURFACE_2,
                borderBottom: `1px solid ${T.BORDER_SOFT}`,
            }}
        >
            <h2
                className="m-0 min-w-0"
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

            <div
                className="flex flex-wrap items-center gap-[7px]"
                style={{ marginTop: 12, fontSize: 15, color: T.TEXT_MUTED }}
            >
                <span
                    className="inline-flex items-center gap-1.5"
                    style={{ color: vm.status.fg, fontWeight: 600 }}
                >
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
                            style={{ color: vm.category.fg, fontWeight: 600 }}
                        >
                            <span
                                style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: 2,
                                    background: vm.category.dot,
                                }}
                            />
                            {td(vm.category.label, { source: "en" })}
                        </span>
                    </>
                )}
                <span style={{ color: T.TEXT_HINT }}>·</span>
                <span
                    className="inline-flex items-center gap-1.5"
                    style={{ color: vm.priority.fg, fontWeight: 600 }}
                >
                    <TaskPriorityStripe priority={vm.priority} size={14} />
                    {td(`${vm.priority.label} priority`, { source: "en" })}
                </span>
            </div>

            <span
                className="inline-flex items-center gap-1.5 whitespace-nowrap"
                style={{
                    marginTop: 14,
                    marginBottom: 4,
                    padding: "4px 11px",
                    borderRadius: 999,
                    fontSize: 14,
                    fontWeight: 600,
                    lineHeight: 1.5,
                    background:
                        vm.bucket === "overdue" ? T.RED_SOFT : vm.dueBg,
                    color: vm.dueColor,
                    border: `1px solid ${
                        vm.bucket === "overdue" ? T.RED_MID : vm.dueBorder
                    }`,
                }}
            >
                <TaskGlyph
                    d={TASK_ICON.calendar}
                    size={13}
                    strokeWidth={1.5}
                    style={{ marginTop: 4, marginBottom: 4 }}
                />
                {task.due_date ? (
                    <>
                        {formatDateWithTime(task.due_date)}
                        {" · "}
                        {td(vm.dueSub, { source: "en" })}
                    </>
                ) : (
                    td("No due date")
                )}
            </span>

            <div className="flex items-center gap-2" style={{ marginTop: 12 }}>
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
                <span style={{ fontSize: 14.5, color: T.TEXT_MUTED }}>
                    {vm.people.length > 0 ? (
                        <>
                            {td("Assigned to")}{" "}
                            <b
                                style={{ color: T.TEXT, fontWeight: 600 }}
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
                    {assigner?.name && ` · ${td("by")} ${assigner.name}`}
                </span>
            </div>
        </div>
    );
}
