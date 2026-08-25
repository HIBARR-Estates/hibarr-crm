import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import { router } from "@inertiajs/react";
import type { Lead } from "@/Types/api/leads";
import { useTd } from "@/Hooks/useDynamicTranslation";

/**
 * ConfirmDialog flow → DELETE lead-contact.destroy → back to the leads list.
 *
 * The endpoint answers with Reply::success/error JSON (the legacy Blade list
 * calls it too), so it must not be driven by `router.delete` — Inertia rejects
 * the non-Inertia response and pops its raw-response modal even though the
 * lead was deleted. axios + an explicit visit keeps the ending predictable.
 */
export default function useLeadDelete(lead: Lead) {
    const { td } = useTd();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const requestDelete = useCallback(() => {
        setConfirmOpen(true);
    }, []);

    const cancelDelete = useCallback(() => {
        if (!deleting) setConfirmOpen(false);
    }, [deleting]);

    const confirmDelete = useCallback(async () => {
        setDeleting(true);
        try {
            const response = await axios.delete(
                route("lead-contact.destroy", lead.id),
                { headers: { Accept: "application/json" } },
            );
            if (response.data?.status !== "success") {
                throw new Error(response.data?.message);
            }
            setConfirmOpen(false);
            message.success(td("Lead deleted", { source: "en" }));
            // replace: this lead's URL is dead, it must not come back on Back.
            router.visit(route("lead-contact.index"), { replace: true });
        } catch (error: unknown) {
            setDeleting(false);
            const detail =
                (error as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ||
                (error as Error)?.message ||
                "Failed to delete lead";
            message.error(td(detail, { source: "en" }));
        }
    }, [lead.id, td]);

    return {
        confirmOpen,
        deleting,
        requestDelete,
        cancelDelete,
        confirmDelete,
        dialogProps: {
            open: confirmOpen,
            title: td("Delete lead", { source: "en" }),
            message: td(`Are you sure you want to delete "${lead.client_name ?? "this lead"}"? This action cannot be undone.`, { source: "en" }),
            confirmLabel: td("Yes, delete", { source: "en" }),
            cancelLabel: td("Cancel", { source: "en" }),
            danger: true as const,
            confirmLoading: deleting,
            onConfirm: confirmDelete,
            onCancel: cancelDelete,
        },
    };
}
