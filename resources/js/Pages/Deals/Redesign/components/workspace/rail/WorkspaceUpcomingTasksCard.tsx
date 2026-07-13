import { useTd } from "@/Hooks/useDynamicTranslation";
import DealPanelHeader from "../../primitives/DealPanelHeader";
import type { WorkspaceTaskPreview } from "../../../adapters/taskAdapter";

interface WorkspaceUpcomingTasksCardProps {
    tasks: WorkspaceTaskPreview[];
    onAddTask: () => void;
    onOpenTasks: () => void;
}

export default function WorkspaceUpcomingTasksCard({
    tasks,
    onAddTask,
    onOpenTasks,
}: WorkspaceUpcomingTasksCardProps) {
    const { td } = useTd();

    return (
        <section className="mb-3 overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">
            <DealPanelHeader
                title={td("Upcoming tasks")}
                rightSlot={
                    <button
                        type="button"
                        onClick={onAddTask}
                        className="border-none bg-transparent text-[11px] font-semibold text-white/85 hover:text-white"
                    >
                        + {td("Add")}
                    </button>
                }
            />
            {tasks.length === 0 ? (
                <p className="px-[13px] py-2.5 text-[13px] italic text-[#9ca3af]">
                    {td("No tasks due.")}
                </p>
            ) : (
                <div className="py-1.5">
                    {tasks.map((task) => (
                        <button
                            key={task.id}
                            type="button"
                            onClick={onOpenTasks}
                            className="flex w-full items-center gap-2 px-[13px] py-2 text-left hover:bg-[#f9fafb]"
                        >
                            <div className="h-3.5 w-3.5 shrink-0 rounded border-2 border-[#e2e5ea]" />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-xs font-medium text-[#1a1f2e]">
                                    {task.title}
                                </div>
                                <div className="text-[10px] text-[#9ca3af]">
                                    {task.dueDateLabel}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
}
