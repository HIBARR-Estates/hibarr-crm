import useTaskStatus, { applyTaskStatus } from "@/Hooks/useTaskStatus";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";

/** Optimistic task-status updater for the lead workspace. Mirrors useDealTaskStatus. */
export default function useLeadTaskStatus() {
    const { setTasks } = useLeadWorkspace();

    return useTaskStatus((taskId, slug) =>
        setTasks((prev) =>
            prev.map((task) =>
                task.id === taskId ? applyTaskStatus(task, slug) : task,
            ),
        ),
    );
}
