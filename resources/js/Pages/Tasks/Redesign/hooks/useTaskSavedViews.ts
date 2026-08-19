import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import { router } from "@inertiajs/react";

export interface TaskSavedView {
    id: number;
    name: string;
    filters: Record<string, any>;
    visibility: "private" | "team";
    pinned: boolean;
    is_owner: boolean;
    owner_name?: string | null;
    updated_at?: string | null;
}

export interface SaveTaskViewPayload {
    name: string;
    filters: Record<string, any>;
    visibility: "private" | "team";
    pinned: boolean;
}

/**
 * Create/rename/delete saved filter views for the redesigned tasks
 * workspace. Mirrors `Features/Filters/useLeadSavedViews.ts` — mutations
 * refresh only the `savedViews` prop rather than reloading the whole page.
 */
export default function useTaskSavedViews() {
    const [saving, setSaving] = useState(false);

    const refresh = useCallback(() => {
        router.reload({ only: ["savedViews"] });
    }, []);

    const createView = useCallback(
        async (payload: SaveTaskViewPayload): Promise<TaskSavedView | null> => {
            setSaving(true);
            try {
                const response = await axios.post(
                    route("task-saved-views.store"),
                    payload,
                    { headers: { Accept: "application/json" } },
                );
                const view = response.data?.data?.view as TaskSavedView;
                refresh();
                return view ?? null;
            } catch (error: any) {
                message.error(
                    error?.response?.data?.message ?? "Could not save view",
                );
                return null;
            } finally {
                setSaving(false);
            }
        },
        [refresh],
    );

    const deleteView = useCallback(
        async (id: number) => {
            setSaving(true);
            try {
                await axios.delete(route("task-saved-views.destroy", { id }), {
                    headers: { Accept: "application/json" },
                });
                refresh();
                return true;
            } catch (error: any) {
                message.error(
                    error?.response?.data?.message ?? "Could not delete view",
                );
                return false;
            } finally {
                setSaving(false);
            }
        },
        [refresh],
    );

    return { saving, createView, deleteView };
}
