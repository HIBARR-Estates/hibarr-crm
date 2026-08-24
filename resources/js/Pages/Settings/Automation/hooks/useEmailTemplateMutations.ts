import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { EmailTemplate } from "../types";
import { useAutomationWorkspace } from "../context/AutomationWorkspaceContext";

/** Email template create/update/delete mutations — same shape/reasoning as
 * useAutomationMutations, wired to EmailTemplateController's JSON endpoints. */
export default function useEmailTemplateMutations() {
    const { t } = useTranslation();
    const { setTemplates } = useAutomationWorkspace();
    const [savingId, setSavingId] = useState<number | "new" | null>(null);

    const createTemplate = useCallback(
        async (payload: Record<string, unknown>): Promise<EmailTemplate | null> => {
            setSavingId("new");
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
                setSavingId(null);
            }
        },
        [setTemplates, t],
    );

    const updateTemplate = useCallback(
        async (id: number, payload: Record<string, unknown>): Promise<EmailTemplate | null> => {
            setSavingId(id);
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
                setSavingId(null);
            }
        },
        [setTemplates, t],
    );

    const deleteTemplate = useCallback(
        async (id: number): Promise<boolean> => {
            setSavingId(id);
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
                setSavingId(null);
            }
        },
        [setTemplates, t],
    );

    return { createTemplate, updateTemplate, deleteTemplate, savingId };
}
