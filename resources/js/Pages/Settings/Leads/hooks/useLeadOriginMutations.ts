import { Dispatch, SetStateAction, useCallback, useState } from "react";
import axios from "axios";
import { App } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import type { LeadOriginRow } from "../types";

type SetOrigins = Dispatch<SetStateAction<LeadOriginRow[]>>;

function firstErrorMessage(error: unknown, fallback: string): string {
    const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
    const errors = data?.errors as Record<string, string[]> | undefined;
    const first = errors ? Object.values(errors).flat()[0] : undefined;
    if (typeof first === "string" && first) return first;
    if (typeof data?.message === "string" && data.message) return data.message;
    return fallback;
}

/** Create / rename / delete / reorder lead origins; patches the tab's list from each response. */
export default function useLeadOriginMutations(setOrigins: SetOrigins) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [reordering, setReordering] = useState(false);
    const headers = { Accept: "application/json" };
    const failed = t("messages.somethingWentWrong");

    const createOrigin = useCallback(
        async (name: string): Promise<boolean> => {
            setSaving(true);
            try {
                const res = await axios.post(route("settings-leads.origins.store"), { name: name.trim() }, { headers });
                setOrigins((prev) => [...prev, res.data.origin as LeadOriginRow]);
                message.success(t("messages.recordSaved"));
                return true;
            } catch (error) {
                message.error(firstErrorMessage(error, failed));
                return false;
            } finally {
                setSaving(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [message, setOrigins, t],
    );

    const updateOrigin = useCallback(
        async (id: number, name: string): Promise<boolean> => {
            setSaving(true);
            try {
                const res = await axios.put(route("settings-leads.origins.update", id), { name: name.trim() }, { headers });
                const updated = res.data.origin as LeadOriginRow;
                setOrigins((prev) => prev.map((origin) => (origin.id === id ? updated : origin)));
                message.success(t("messages.updateSuccess"));
                return true;
            } catch (error) {
                message.error(firstErrorMessage(error, failed));
                return false;
            } finally {
                setSaving(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [message, setOrigins, t],
    );

    const deleteOrigin = useCallback(
        async (id: number): Promise<boolean> => {
            setDeletingId(id);
            try {
                await axios.delete(route("settings-leads.origins.destroy", id), { headers });
                setOrigins((prev) => prev.filter((origin) => origin.id !== id));
                message.success(t("messages.deleteSuccess"));
                return true;
            } catch (error) {
                message.error(firstErrorMessage(error, failed));
                return false;
            } finally {
                setDeletingId(null);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [message, setOrigins, t],
    );

    /** Optimistic: the list moves at once and snaps back if the server refuses. */
    const moveOrigin = useCallback(
        async (current: LeadOriginRow[], from: number, to: number) => {
            if (to < 0 || to >= current.length) return;
            const next = [...current];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            setOrigins(next);
            setReordering(true);
            try {
                const res = await axios.post(
                    route("settings-leads.origins.reorder"),
                    { originIds: next.map((origin) => origin.id) },
                    { headers },
                );
                setOrigins(res.data.origins as LeadOriginRow[]);
            } catch (error) {
                setOrigins(current);
                message.error(firstErrorMessage(error, failed));
            } finally {
                setReordering(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [message, setOrigins, t],
    );

    return { createOrigin, updateOrigin, deleteOrigin, moveOrigin, saving, deletingId, reordering };
}
