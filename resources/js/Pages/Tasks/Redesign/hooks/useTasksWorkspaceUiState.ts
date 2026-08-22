import { useCallback, useState } from "react";
import {
    patchTasksWorkspaceUi,
    readTasksWorkspaceUi,
} from "./tasksWorkspaceUiStore";

/**
 * Modal open flags mirrored into the module store so deferred Inertia reloads
 * do not close dialogs the user already has open.
 */
export default function useTasksWorkspaceUiState() {
    const snapshot = readTasksWorkspaceUi();

    const [addOpen, setAddOpenState] = useState(snapshot.addOpen);
    const [editingTaskId, setEditingTaskIdState] = useState<number | null>(
        snapshot.editingTaskId,
    );
    const [duplicatingTaskId, setDuplicatingTaskIdState] = useState<
        number | null
    >(snapshot.duplicatingTaskId);

    const setAddOpen = useCallback((open: boolean) => {
        patchTasksWorkspaceUi({ addOpen: open });
        setAddOpenState(open);
    }, []);

    const setEditingTaskId = useCallback((taskId: number | null) => {
        patchTasksWorkspaceUi({ editingTaskId: taskId });
        setEditingTaskIdState(taskId);
    }, []);

    const setDuplicatingTaskId = useCallback((taskId: number | null) => {
        patchTasksWorkspaceUi({ duplicatingTaskId: taskId });
        setDuplicatingTaskIdState(taskId);
    }, []);

    return {
        addOpen,
        setAddOpen,
        editingTaskId,
        setEditingTaskId,
        duplicatingTaskId,
        setDuplicatingTaskId,
    };
}
