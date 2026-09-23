import { Dispatch, SetStateAction, useCallback, useRef, useState } from "react";
import axios from "axios";
import { App } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import type { LeadStatusDraft, LeadStatusRow } from "../types";

type SetStatuses = Dispatch<SetStateAction<LeadStatusRow[]>>;

function firstErrorMessage(error: unknown, fallback: string): string {
    const data = (error as { response?: { data?: Record<string, unknown> } })
        ?.response?.data;
    const errors = data?.errors as Record<string, string[]> | undefined;
    if (errors) {
        const first = Object.values(errors).flat()[0];
        if (typeof first === "string" && first.length > 0) {
            return first;
        }
    }
    if (typeof data?.message === "string" && data.message.length > 0) {
        return data.message;
    }

    return fallback;
}

export default function useLeadStatusMutations(setStatuses: SetStatuses) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [reordering, setReordering] = useState(false);
    const snapshotRef = useRef<LeadStatusRow[] | null>(null);

    const createStatus = useCallback(
        async (draft: LeadStatusDraft): Promise<boolean> => {
            setSaving(true);
            try {
                const res = await axios.post(
                    route("settings-leads.statuses.store"),
                    draft,
                    { headers: { Accept: "application/json" } },
                );
                if (res.data?.status === "success" && res.data?.lead_status) {
                    setStatuses((prev) => [
                        ...prev,
                        res.data.lead_status as LeadStatusRow,
                    ]);
                    message.success(t("messages.recordSaved"));
                    return true;
                }
                message.error(res.data?.message || t("messages.somethingWentWrong"));
                return false;
            } catch (error) {
                message.error(
                    firstErrorMessage(error, t("messages.somethingWentWrong")),
                );
                return false;
            } finally {
                setSaving(false);
            }
        },
        [message, setStatuses, t],
    );

    const updateStatus = useCallback(
        async (id: number, draft: LeadStatusDraft): Promise<boolean> => {
            setSaving(true);
            try {
                const res = await axios.put(
                    route("settings-leads.statuses.update", id),
                    draft,
                    { headers: { Accept: "application/json" } },
                );
                if (res.data?.status === "success" && res.data?.lead_status) {
                    const updated = res.data.lead_status as LeadStatusRow;
                    setStatuses((prev) =>
                        prev.map((row) => (row.id === id ? updated : row)),
                    );
                    message.success(t("messages.updateSuccess"));
                    return true;
                }
                message.error(res.data?.message || t("messages.somethingWentWrong"));
                return false;
            } catch (error) {
                message.error(
                    firstErrorMessage(error, t("messages.somethingWentWrong")),
                );
                return false;
            } finally {
                setSaving(false);
            }
        },
        [message, setStatuses, t],
    );

    const deleteStatus = useCallback(
        async (id: number): Promise<boolean> => {
            setDeletingId(id);
            try {
                const res = await axios.delete(
                    route("settings-leads.statuses.destroy", id),
                    { headers: { Accept: "application/json" } },
                );
                if (res.data?.status === "success") {
                    setStatuses((prev) => prev.filter((row) => row.id !== id));
                    message.success(t("messages.deleteSuccess"));
                    return true;
                }
                message.error(res.data?.message || t("messages.somethingWentWrong"));
                return false;
            } catch (error) {
                message.error(
                    firstErrorMessage(error, t("messages.somethingWentWrong")),
                );
                return false;
            } finally {
                setDeletingId(null);
            }
        },
        [message, setStatuses, t],
    );

    const beginReorder = useCallback((current: LeadStatusRow[]) => {
        snapshotRef.current = current;
    }, []);

    const persistReorder = useCallback(
        async (ordered: LeadStatusRow[]) => {
            const snapshot = snapshotRef.current;
            snapshotRef.current = null;
            const ids = ordered.map((row) => row.id);
            if (
                snapshot &&
                snapshot.length === ids.length &&
                snapshot.every((row, index) => row.id === ids[index])
            ) {
                return;
            }
            setReordering(true);
            try {
                const res = await axios.post(
                    route("settings-leads.statuses.reorder"),
                    { statusIds: ids },
                    { headers: { Accept: "application/json" } },
                );
                if (
                    res.data?.status === "success" &&
                    Array.isArray(res.data.lead_statuses)
                ) {
                    setStatuses(res.data.lead_statuses as LeadStatusRow[]);
                    return;
                }
                if (snapshot) setStatuses(snapshot);
                message.error(res.data?.message || t("messages.somethingWentWrong"));
            } catch (error) {
                if (snapshot) setStatuses(snapshot);
                message.error(
                    firstErrorMessage(error, t("messages.somethingWentWrong")),
                );
            } finally {
                setReordering(false);
            }
        },
        [message, setStatuses, t],
    );

    return {
        createStatus,
        updateStatus,
        deleteStatus,
        beginReorder,
        persistReorder,
        saving,
        deletingId,
        reordering,
    };
}
