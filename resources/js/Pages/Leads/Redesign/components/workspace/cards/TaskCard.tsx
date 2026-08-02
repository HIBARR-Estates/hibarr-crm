import type { ReactNode } from "react";
import PriorityBadge from "@/Components/Redesign/primitives/PriorityBadge";
import type { LeadTaskPreview } from "../../../adapters/taskAdapter";

interface TaskCardProps {
    task: LeadTaskPreview;
    onClick?: () => void;
    statusControl?: ReactNode;
}

export default function TaskCard({ task, onClick, statusControl }: TaskCardProps) {
    return (
        <div className="v2-task-card mb-2">
            <div className="flex items-start gap-2">
                {statusControl}
                <button
                    type="button"
                    className="min-w-0 flex-1 cursor-pointer border-none bg-transparent p-0 text-left"
                    onClick={onClick}
                >
                    <div className="mb-1 flex items-start justify-between gap-2">
                        <span
                            className={`text-[13px] font-medium text-[#1a1f2e]${!task.isOpen ? " line-through opacity-60" : ""}`}
                        >
                            {task.title}
                        </span>
                        <PriorityBadge priority={task.priority} />
                    </div>
                    {task.dueDateLabel && (
                        <div className="text-[11px] text-[#9ca3af]">
                            Due {task.dueDateLabel}
                        </div>
                    )}
                </button>
            </div>
        </div>
    );
}
