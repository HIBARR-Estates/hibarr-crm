import useTaskStatus, { applyTaskStatus } from "@/Hooks/useTaskStatus";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

/**
 * Optimistic task-status updater for the deal workspace (Overview + Tasks
 * tabs). The bookkeeping lives in @/Hooks/useTaskStatus; this only says where
 * the patched task goes.
 */
export default function useDealTaskStatus() {
    const { setTasks } = useDealWorkspace();

    return useTaskStatus((taskId, slug) =>
        setTasks((prev) =>
            prev.map((task) =>
                task.id === taskId ? applyTaskStatus(task, slug) : task,
            ),
        ),
    );
}
