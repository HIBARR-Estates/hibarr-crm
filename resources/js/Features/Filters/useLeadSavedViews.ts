import { useCallback, useMemo, useState } from "react";
import axios from "axios";
import { message } from "antd";
import { router } from "@inertiajs/react";

export interface LeadSavedView {
    id: number;
    name: string;
    filters: Record<string, any>;
    visibility: "private" | "team";
    pinned: boolean;
    is_owner: boolean;
    owner_name?: string | null;
    updated_at?: string | null;
}

export interface SaveViewPayload {
    name: string;
    filters: Record<string, any>;
    visibility: "private" | "team";
    pinned: boolean;
}

/** Entities that expose saved filter views; each owns a matching route group. */
export type SavedViewEntity = "lead" | "task" | "project";

/**
 * Create/rename/delete saved filter views. Mutations refresh only the
 * `savedViews` prop rather than reloading the whole page.
 *
 * The entity selects the route group (`lead-saved-views.*` /
 * `task-saved-views.*` / `project-saved-views.*`), so each entity shares one
 * implementation and one UI. Defaults to leads, which is how every existing
 * caller uses it.
 */
export default function useLeadSavedViews(entity: SavedViewEntity = "lead") {
    const [saving, setSaving] = useState(false);

    const routes = useMemo(
        () => ({
            store: `${entity}-saved-views.store`,
            update: `${entity}-saved-views.update`,
            destroy: `${entity}-saved-views.destroy`,
        }),
        [entity],
    );

    const refresh = useCallback(() => {
        router.reload({ only: ["savedViews"] });
    }, []);

    const createView = useCallback(
        async (payload: SaveViewPayload): Promise<LeadSavedView | null> => {
            setSaving(true);
            try {
                const response = await axios.post(
                    route(routes.store),
                    payload,
                    { headers: { Accept: "application/json" } },
                );
                const view = response.data?.data?.view as LeadSavedView;
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

    const updateView = useCallback(
        async (id: number, payload: Partial<SaveViewPayload>) => {
            setSaving(true);
            try {
                await axios.patch(route(routes.update, { id }), payload, {
                    headers: { Accept: "application/json" },
                });
                refresh();
                return true;
            } catch (error: any) {
                message.error(
                    error?.response?.data?.message ?? "Could not update view",
                );
                return false;
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
                await axios.delete(route(routes.destroy, { id }), {
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

    return { saving, createView, updateView, deleteView };
}
