import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { message } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { EmailTemplate } from "../types";
import { useAutomationWorkspace } from "../context/AutomationWorkspaceContext";

type PendingKey = number | "new";

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

/** Email template create/update/delete mutations — same shape/reasoning as
 * useAutomationMutations, wired to EmailTemplateController's JSON endpoints. */
export default function useEmailTemplateMutations() {
    const { t } = useTranslation();
    const { setTemplates } = useAutomationWorkspace();
    const { add, remove, isPending } = usePendingKeys();

    const createTemplate = useCallback(
        async (payload: Record<string, unknown>): Promise<EmailTemplate | null> => {
            const key: PendingKey = "new";
            add(key);
            try {
                const res = await axios.post(route("email-templates.store"), payload, {
                    headers: { Accept: "application/json" },
                });
                if (res.data?.status === "success" && res.data?.data) {
                    const created = { ...res.data.data, automation_actions_count: 0 } as EmailTemplate;
                    setTemplates((prev) => [...prev, created]);
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
        [add, remove, setTemplates, t],
    );

    const updateTemplate = useCallback(
        async (id: number, payload: Record<string, unknown>): Promise<EmailTemplate | null> => {
            add(id);
            try {
                const res = await axios.put(route("email-templates.update", id), payload, {
                    headers: { Accept: "application/json" },
                });
                if (res.data?.status === "success" && res.data?.data) {
                    setTemplates((prev) =>
                        prev.map((tpl) =>
                            tpl.id === id
                                ? { ...tpl, ...res.data.data, automation_actions_count: tpl.automation_actions_count }
                                : tpl,
                        ),
                    );
                    message.success(res.data.message || t("messages.updateSuccess"));
                    return res.data.data as EmailTemplate;
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
        [add, remove, setTemplates, t],
    );

    const deleteTemplate = useCallback(
        async (id: number): Promise<boolean> => {
            add(id);
            try {
                const res = await axios.delete(route("email-templates.destroy", id), {
                    headers: { Accept: "application/json" },
                });
                if (res.data?.status === "success") {
                    setTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
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
        [add, remove, setTemplates, t],
    );

    return { createTemplate, updateTemplate, deleteTemplate, isSaving: isPending, savingId: isPending("new") ? "new" : null };
}
