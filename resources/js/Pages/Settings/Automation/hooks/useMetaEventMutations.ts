import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { MetaEvent } from "../types";
import { useAutomationWorkspace } from "../context/AutomationWorkspaceContext";

/** Meta Event create/update/delete mutations — same shape/reasoning as
 * useEmailTemplateMutations, wired to MetaEventController's JSON endpoints.
 * store()/update() don't recompute `using_automations` (that's a cross-table
 * scan only worth doing on the list load), so it's defaulted/preserved
 * client-side instead of trusting the response for that one field. */
export default function useMetaEventMutations() {
    const { t } = useTranslation();
    const { setMetaEvents } = useAutomationWorkspace();
    const [savingId, setSavingId] = useState<number | "new" | null>(null);

    const createMetaEvent = useCallback(
        async (payload: Record<string, unknown>): Promise<MetaEvent | null> => {
            setSavingId("new");
            try {
                const res = await axios.post(route("meta-events.store"), payload, {
                    headers: { Accept: "application/json" },
                });
                if (res.data?.status === "success" && res.data?.data) {
                    const created = { ...res.data.data, using_automations: [] } as MetaEvent;
                    setMetaEvents((prev) => [...prev, created]);
                    message.success(res.data.message || t("messages.recordSaved"));
                    return created;
                }
                message.error(res.data?.message || t("messages.somethingWentWrong"));
                return null;
            } catch (error: any) {
                message.error(error?.response?.data?.message || t("messages.somethingWentWrong"));
                return null;
            } finally {
                setSavingId(null);
            }
        },
        [setMetaEvents, t],
    );

    const updateMetaEvent = useCallback(
        async (id: number, payload: Record<string, unknown>): Promise<MetaEvent | null> => {
            setSavingId(id);
            try {
                const res = await axios.put(route("meta-events.update", id), payload, {
                    headers: { Accept: "application/json" },
                });
                if (res.data?.status === "success" && res.data?.data) {
                    let updated: MetaEvent | null = null;
                    setMetaEvents((prev) =>
                        prev.map((ev): MetaEvent => {
                            if (ev.id !== id) return ev;
                            const merged: MetaEvent = { ...ev, ...res.data.data, using_automations: ev.using_automations };
                            updated = merged;
                            return merged;
                        }),
                    );
                    message.success(res.data.message || t("messages.updateSuccess"));
                    return updated;
                }
                message.error(res.data?.message || t("messages.somethingWentWrong"));
                return null;
            } catch (error: any) {
                message.error(error?.response?.data?.message || t("messages.somethingWentWrong"));
                return null;
            } finally {
                setSavingId(null);
            }
        },
        [setMetaEvents, t],
    );

    const deleteMetaEvent = useCallback(
        async (id: number): Promise<boolean> => {
            setSavingId(id);
            try {
                const res = await axios.delete(route("meta-events.destroy", id), {
                    headers: { Accept: "application/json" },
                });
                if (res.data?.status === "success") {
                    setMetaEvents((prev) => prev.filter((ev) => ev.id !== id));
                    message.success(res.data.message || t("messages.deleteSuccess"));
                    return true;
                }
                message.error(res.data?.message || t("messages.somethingWentWrong"));
                return false;
            } catch (error: any) {
                message.error(error?.response?.data?.message || t("messages.somethingWentWrong"));
                return false;
            } finally {
                setSavingId(null);
            }
        },
        [setMetaEvents, t],
    );

    return { createMetaEvent, updateMetaEvent, deleteMetaEvent, savingId };
}
