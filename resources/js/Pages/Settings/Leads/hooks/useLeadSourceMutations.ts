import { Dispatch, SetStateAction, useCallback, useRef, useState } from "react";
import axios from "axios";
import { App } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import type { LeadSourceRow } from "../types";

type SetSources = Dispatch<SetStateAction<LeadSourceRow[]>>;

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

export default function useLeadSourceMutations(setSources: SetSources) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [reordering, setReordering] = useState(false);
    const snapshotRef = useRef<LeadSourceRow[] | null>(null);

    const createSource = useCallback(
        async (type: string): Promise<boolean> => {
            const trimmed = type.trim();
            if (!trimmed) return false;
            setSaving(true);
            try {
                const res = await axios.post(
                    route("settings-leads.sources.store"),
                    { type: trimmed },
                    { headers: { Accept: "application/json" } },
                );
                if (res.data?.status === "success" && res.data?.source) {
                    setSources((prev) => [...prev, res.data.source as LeadSourceRow]);
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
        [message, setSources, t],
    );

    const updateSource = useCallback(
        async (id: number, type: string): Promise<boolean> => {
            const trimmed = type.trim();
            if (!trimmed) return false;
            setSaving(true);
            try {
                const res = await axios.put(
                    route("settings-leads.sources.update", id),
                    { type: trimmed },
                    { headers: { Accept: "application/json" } },
                );
                if (res.data?.status === "success" && res.data?.source) {
                    const updated = res.data.source as LeadSourceRow;
                    setSources((prev) =>
                        prev.map((source) => (source.id === id ? updated : source)),
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
        [message, setSources, t],
    );

    const deleteSource = useCallback(
        async (id: number): Promise<boolean> => {
            setDeletingId(id);
            try {
                const res = await axios.delete(
                    route("settings-leads.sources.destroy", id),
                    { headers: { Accept: "application/json" } },
                );
                if (res.data?.status === "success") {
                    setSources((prev) => prev.filter((source) => source.id !== id));
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
        [message, setSources, t],
    );

    const beginReorder = useCallback((current: LeadSourceRow[]) => {
        snapshotRef.current = current;
    }, []);

    const persistReorder = useCallback(
        async (ordered: LeadSourceRow[]) => {
            const snapshot = snapshotRef.current;
            snapshotRef.current = null;
            const ids = ordered.map((source) => source.id);
            if (
                snapshot &&
                snapshot.length === ids.length &&
                snapshot.every((source, index) => source.id === ids[index])
            ) {
                return;
            }
            setReordering(true);
            try {
                const res = await axios.post(
                    route("settings-leads.sources.reorder"),
                    { sourceIds: ids },
                    { headers: { Accept: "application/json" } },
                );
                if (res.data?.status === "success" && Array.isArray(res.data.sources)) {
                    setSources(res.data.sources as LeadSourceRow[]);
                    return;
                }
                if (snapshot) setSources(snapshot);
                message.error(res.data?.message || t("messages.somethingWentWrong"));
            } catch (error) {
                if (snapshot) setSources(snapshot);
                message.error(
                    firstErrorMessage(error, t("messages.somethingWentWrong")),
                );
            } finally {
                setReordering(false);
            }
        },
        [message, setSources, t],
    );

    return {
        createSource,
        updateSource,
        deleteSource,
        beginReorder,
        persistReorder,
        saving,
        deletingId,
        reordering,
    };
}
