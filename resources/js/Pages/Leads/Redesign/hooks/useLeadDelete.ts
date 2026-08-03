import { useCallback, useState } from "react";
import { router } from "@inertiajs/react";
import type { Lead } from "@/Types/api/leads";
import { useTd } from "@/Hooks/useDynamicTranslation";

/**
 * ConfirmDialog flow → router.delete lead-contact.destroy → redirect.
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

    const confirmDelete = useCallback(() => {
        setDeleting(true);
        router.delete(route("lead-contact.destroy", lead.id), {
            onFinish: () => {
                setDeleting(false);
                setConfirmOpen(false);
            },
        });
    }, [lead.id]);

    return {
        confirmOpen,
        deleting,
        requestDelete,
        cancelDelete,
        confirmDelete,
        dialogProps: {
            open: confirmOpen,
            title: td("Delete lead"),
            message: td(
                `Are you sure you want to delete "${lead.client_name ?? "this lead"}"? This action cannot be undone.`,
            ),
            confirmLabel: td("Yes, delete"),
            cancelLabel: td("Cancel"),
            danger: true as const,
            confirmLoading: deleting,
            onConfirm: confirmDelete,
            onCancel: cancelDelete,
        },
    };
}
