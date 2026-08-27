import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { message } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { Automation } from "../types";
import { useAutomationWorkspace } from "../context/AutomationWorkspaceContext";

type PendingKey = number | "new";

/** Track each in-flight mutation independently so one finish does not clear others. */
function usePendingKeys() {
    const pendingRef = useRef<Set<PendingKey>>(new Set());
    const [, bump] = useState(0);

    const add = useCallback((key: PendingKey) => {
        pendingRef.current.add(key);
        bump((n) => n + 1);
    }, []);

    const remove = useCallback((key: PendingKey) => {
        pendingRef.current.delete(key);
        bump((n) => n + 1);
    }, []);

    const isPending = useCallback((key: PendingKey) => pendingRef.current.has(key), []);

    return { add, remove, isPending };
}

/**
 * Automation create/update/delete/toggle-status mutations, wired to the
 * DealAutomationController JSON endpoints (see AutomationSettingController's
 * docblock — same validation/model code as the classic Blade builder).
 */
export default function useAutomationMutations() {
    const { t } = useTranslation();
    const { setAutomations } = useAutomationWorkspace();
    const { add, remove, isPending } = usePendingKeys();

    const createAutomation = useCallback(
        async (payload: Record<string, unknown>): Promise<Automation | null> => {
            const key: PendingKey = "new";
            add(key);
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
                remove(key);
            }
        },
        [add, remove, setAutomations, t],
    );

    const updateAutomation = useCallback(
        async (id: number, payload: Record<string, unknown>): Promise<Automation | null> => {
            add(id);
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
                remove(id);
            }
        },
        [add, remove, setAutomations, t],
    );

    const deleteAutomation = useCallback(
        async (id: number): Promise<boolean> => {
            add(id);
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
                remove(id);
            }
        },
        [add, remove, setAutomations, t],
    );

    const toggleStatus = useCallback(
        async (id: number, nextActive: boolean): Promise<boolean> => {
            add(id);
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
                remove(id);
            }
        },
        [add, remove, setAutomations, t],
    );

    const savingId = isPending("new") ? "new" : null;

    return {
        createAutomation,
        updateAutomation,
        deleteAutomation,
        toggleStatus,
        isSaving: isPending,
        savingId,
    };
}
