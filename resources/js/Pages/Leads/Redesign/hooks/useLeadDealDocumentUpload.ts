import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";
import type { LeadDocumentItem } from "./useLeadDocuments";

/**
 * Uploads into a deal-owned FILE field cross-populated onto the lead
 * (FieldModal's "Show in Lead") via the same `deals.gathering.inline_update`
 * contract the deal Files tab uses — the value genuinely lives on that
 * specific deal's own custom_fields_data, so the upload targets it directly.
 *
 * Patches the lead workspace's `deals` array from the response instead of
 * an Inertia reload — same rule as every other mutation in this codebase.
 */
function extractBackendMessage(error: unknown): string | undefined {
    if (!axios.isAxiosError(error)) return undefined;
    return (error.response?.data as { message?: string } | undefined)?.message;
}

export default function useLeadDealDocumentUpload() {
    const { setDeals } = useLeadWorkspace();
    const { t } = useTranslation();
    // A Set (not a single key) so two slots uploading concurrently each stay
    // blocked until their own request settles — a single shared key would
    // have the second upload's start overwrite the first's key, then
    // whichever request's `finally` ran first would clear the *other* slot's
    // still-in-flight indicator too.
    const [uploadingKeys, setUploadingKeys] = useState<Set<string>>(new Set());
    const [deletingKey, setDeletingKey] = useState<string | null>(null);

    const patchDeal = useCallback(
        (dealId: number, updatedDeal: Record<string, unknown>) => {
            setDeals((prev) =>
                prev.map((deal) =>
                    deal.id === dealId ? { ...deal, ...updatedDeal } : deal,
                ),
            );
        },
        [setDeals],
    );

    const uploadToSlot = useCallback(
        async (dealId: number, doc: LeadDocumentItem, file: File) => {
            if (!doc.fieldName || !doc.updateType) return;
            const key = `${dealId}:${doc.fieldName}`;

            setUploadingKeys((prev) => new Set(prev).add(key));
            try {
                const formData = new FormData();
                formData.append("_method", "PATCH");
                formData.append("type", doc.updateType);
                formData.append(`data[${doc.fieldName}]`, file);

                const response = await axios.post(
                    route("deals.gathering.inline_update", { id: dealId }),
                    formData,
                    { headers: { Accept: "application/json" } },
                );

                if (response.data?.status === "success" && response.data?.data) {
                    patchDeal(dealId, response.data.data);
                    message.success(t("pages.deals.info.file_upload_success"));
                } else {
                    message.error(
                        response.data?.message ??
                            t("pages.deals.workspace.files.messages.upload_failed"),
                    );
                }
            } catch (error) {
                message.error(
                    extractBackendMessage(error) ??
                        t("pages.deals.workspace.files.messages.upload_failed"),
                );
            } finally {
                setUploadingKeys((prev) => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                });
            }
        },
        [patchDeal, t],
    );

    const deleteSlot = useCallback(
        async (dealId: number, doc: LeadDocumentItem) => {
            if (!doc.fieldName || !doc.updateType) return;
            const key = `${dealId}:${doc.fieldName}`;

            setDeletingKey(key);
            try {
                const response = await axios.patch(
                    route("deals.gathering.inline_update", { id: dealId }),
                    { type: doc.updateType, data: { [doc.fieldName]: null } },
                    { headers: { Accept: "application/json" } },
                );

                if (response.data?.status === "success" && response.data?.data) {
                    patchDeal(dealId, response.data.data);
                    message.success(t("pages.deals.workspace.documents.delete_success"));
                } else {
                    message.error(
                        response.data?.message ??
                            t("pages.deals.workspace.documents.delete_failed"),
                    );
                }
            } catch (error) {
                message.error(
                    extractBackendMessage(error) ??
                        t("pages.deals.workspace.documents.delete_failed"),
                );
            } finally {
                setDeletingKey(null);
            }
        },
        [patchDeal, t],
    );

    return {
        uploadToSlot,
        deleteSlot,
        isUploadingSlot: (dealId: number, fieldName?: string) =>
            Boolean(fieldName) && uploadingKeys.has(`${dealId}:${fieldName}`),
        isDeletingSlot: (dealId: number, fieldName?: string) =>
            Boolean(fieldName) && deletingKey === `${dealId}:${fieldName}`,
    };
}
