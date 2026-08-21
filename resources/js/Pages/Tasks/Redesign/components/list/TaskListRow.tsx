import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import MultiUserIndicator from "@/Components/MultiUserIndicator";
import SelectCheckbox from "@/Components/Redesign/primitives/SelectCheckbox";
import TaskStatusSelect from "../primitives/TaskStatusSelect";
import {
    TaskCategoryTag,
    TaskPriorityPill,
    TaskPriorityStripe,
} from "../primitives/TaskGlyphs";
import TaskRowMenu, { type TaskRowAction } from "../primitives/TaskRowMenu";
import TaskRecordIcon from "../primitives/TaskRecordIcon";
import type { TaskViewModel } from "../../adapters/taskViewModel";

interface TaskListRowProps {
    vm: TaskViewModel;
    striped: boolean;
    paddingY: string;
    columns: TaskboardColumn[];
    priorityTreatment: "stripe" | "pill";
    showRowCategory: boolean;
    selected: boolean;
    statusPending: boolean;
    actions: TaskRowAction[];
    onOpen: () => void;
    onToggleSelect: () => void;
    onStatusChange: (slug: string, columnId: number) => void;
}

export default function TaskListRow({
    vm,
    striped,
    paddingY,
    columns,
    priorityTreatment,
    showRowCategory,
    selected,
    statusPending,
    actions,
    onOpen,
    onToggleSelect,
    onStatusChange,
}: TaskListRowProps) {
    const { td } = useTd();

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen();
                }
            }}
            className={`tasks-row flex cursor-pointer items-center gap-3${
                striped ? " tasks-row-stripe" : ""
            }`}
            style={{
                padding: `${paddingY} 18px`,
                borderBottom: `1px solid ${T.BORDER_SOFT}`,
            }}
        >
            <SelectCheckbox
                checked={selected}
                onChange={onToggleSelect}
                label={`${td("Select")} — ${vm.title}`}
            />

            {priorityTreatment === "stripe" && (
                <TaskPriorityStripe priority={vm.priority} />
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
                            textDecoration: vm.titleDecoration,
                        }}
                    >
                        {vm.title}
                    </span>
                    {priorityTreatment === "pill" && (
                        <TaskPriorityPill priority={vm.priority} />
                    )}
                </div>

                <div
                    className="flex min-w-0 items-center gap-2"
                    style={{ fontSize: 14, color: T.TEXT_MUTED }}
                >
                    {showRowCategory && vm.category && (
                        <>
                            <TaskCategoryTag category={vm.category} />
                            {(vm.links.length > 0 || vm.extraLinks > 0) && (
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
                                <span className="truncate">{link.name}</span>
                            </>
                        );
                        return link.href ? (
                            <a
                                key={`${link.type}-${link.name}`}
                                href={link.href}
                                onClick={(event) => event.stopPropagation()}
                                className="tasks-entity-link inline-flex min-w-0 items-center gap-1.5"
                                style={{ color: T.TEXT_MUTED }}
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

            <div
                className="flex flex-shrink-0 flex-col gap-0.5 text-right"
                style={{ width: 152 }}
            >
                <span
                    className="truncate"
                    style={{
                        fontSize: 14,
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                        color: vm.dueColor,
                    }}
                >
                    {td(vm.dueText, { source: "en" })}
                </span>
                <span style={{ fontSize: 14, color: T.TEXT_HINT }}>
                    {td(vm.dueSub, { source: "en" })}
                </span>
            </div>

            <div className="flex flex-shrink-0 justify-end" style={{ width: 56 }}>
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
                onClick={(event) => event.stopPropagation()}
            >
                <TaskStatusSelect
                    status={vm.statusSlug}
                    columns={columns}
                    loading={statusPending}
                    onChange={onStatusChange}
                />
            </div>

            <TaskRowMenu
                actions={actions}
                ariaLabel={`${td("Actions for")} ${vm.title}`}
            />
        </div>
    );
}
