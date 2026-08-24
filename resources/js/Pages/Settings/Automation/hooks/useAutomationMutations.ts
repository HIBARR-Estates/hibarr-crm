import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { Automation } from "../types";
import { useAutomationWorkspace } from "../context/AutomationWorkspaceContext";

/**
 * Automation create/update/delete/toggle-status mutations, wired to the
 * DealAutomationController JSON endpoints (see AutomationSettingController's
 * docblock — same validation/model code as the classic Blade builder).
 *
 * Unlike useDealNoteMutations (one useApiMutate instance per fixed record
 * id), these calls target an *arbitrary* row from a list (any automation id
 * can be toggled/deleted from AutomationsList/Overview), so the id is a
 * per-call argument rather than baked into the hook at instantiation time —
 * axios is used directly instead of useApiMutate for that reason.
 */
export default function useAutomationMutations() {
    const { t } = useTranslation();
    const { setAutomations } = useAutomationWorkspace();
    const [savingId, setSavingId] = useState<number | "new" | null>(null);

    const createAutomation = useCallback(
        async (payload: Record<string, unknown>): Promise<Automation | null> => {
            setSavingId("new");
            try {
                const res = await axios.post(route("deal-automations.store"), payload, {
                    headers: { Accept: "application/json" },
                });
                if (res.data?.status === "success" && res.data?.data) {
                    const created = res.data.data as Automation;
                    setAutomations((prev) => [...prev, created]);
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
        [setAutomations, t],
    );

    const updateAutomation = useCallback(
        async (id: number, payload: Record<string, unknown>): Promise<Automation | null> => {
            setSavingId(id);
            try {
                const res = await axios.put(route("deal-automations.update", id), payload, {
                    headers: { Accept: "application/json" },
                });
                if (res.data?.status === "success" && res.data?.data) {
                    const updated = res.data.data as Automation;
                    setAutomations((prev) => prev.map((a) => (a.id === id ? updated : a)));
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
        [setAutomations, t],
    );

    const deleteAutomation = useCallback(
        async (id: number): Promise<boolean> => {
            setSavingId(id);
            try {
                const res = await axios.delete(route("deal-automations.destroy", id), {
                    headers: { Accept: "application/json" },
                });
                if (res.data?.status === "success") {
                    setAutomations((prev) => prev.filter((a) => a.id !== id));
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
        [setAutomations, t],
    );

    // deal-automations.change-status doesn't return the updated row (just a
    // success/message body) — the switch flip always succeeds or throws, so
    // we patch `active` from the requested value rather than from a response.
    const toggleStatus = useCallback(
        async (id: number, nextActive: boolean): Promise<boolean> => {
            setSavingId(id);
            try {
                const res = await axios.post(
                    route("deal-automations.change-status"),
                    { id, status: nextActive ? "active" : "inactive" },
                    { headers: { Accept: "application/json" } },
                );
                if (res.data?.status === "success") {
                    setAutomations((prev) =>
                        prev.map((a) => (a.id === id ? { ...a, active: nextActive } : a)),
                    );
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
        [setAutomations, t],
    );

    return { createAutomation, updateAutomation, deleteAutomation, toggleStatus, savingId };
}
