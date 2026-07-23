import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import { useDealWorkspace } from "../context/DealWorkspaceContext";
import type { DealDocumentItem } from "./useDealDocuments";

/**
 * Uploads a file into a single document slot (a HIBARR document field or a
 * file-typed custom field) via the same `deals.gathering.inline_update`
 * contract the Deal Info tab uses.
 *
 * ponytail: this repeats the FormData branch of useDealInfoFieldUpdate rather
 * than reusing it, because that hook also pulls useCurrencies() — which would
 * fire a currencies request on every deal page load once mounted in the
 * always-rendered dossier rail. Fold them back together if that hook ever
 * stops fetching.
 */
function extractBackendMessage(error: unknown): string | undefined {
    if (!axios.isAxiosError(error)) return undefined;
    return (error.response?.data as { message?: string } | undefined)?.message;
}

export default function useDealDocumentUpload() {
    const { deal, setDeal } = useDealWorkspace();
    const { t } = useTranslation();
    const { canEdit } = useDealPermissions(deal);
    const [uploadingField, setUploadingField] = useState<string | null>(null);
    const [deletingField, setDeletingField] = useState<string | null>(null);

    const uploadToSlot = useCallback(
        async (doc: DealDocumentItem, file: File) => {
            if (!doc.fieldName || !doc.updateType) return;

            setUploadingField(doc.fieldName);
            try {
                const formData = new FormData();
                formData.append("_method", "PATCH");
                formData.append("type", doc.updateType);
                formData.append(`data[${doc.fieldName}]`, file);

                const response = await axios.post(
                    route("deals.gathering.inline_update", { id: deal.id }),
                    formData,
                    { headers: { Accept: "application/json" } },
                );

                if (
                    response.data?.status === "success" &&
                    response.data?.data
                ) {
                    setDeal(response.data.data);
                    message.success(t("pages.deals.info.file_upload_success"));
                } else {
                    message.error(
                        response.data?.message ??
                            t("pages.deals.workspace.files.messages.upload_failed"),
                    );
                }
            } catch (error) {
                // In dev (app.debug=true) the backend includes the real error
                // message — show it instead of the generic fallback.
                message.error(
                    extractBackendMessage(error) ??
                        t("pages.deals.workspace.files.messages.upload_failed"),
                );
            } finally {
                setUploadingField(null);
            }
        },
        [deal.id, setDeal, t],
    );

    const deleteSlot = useCallback(
        async (doc: DealDocumentItem) => {
            if (!doc.fieldName || !doc.updateType) return;

            setDeletingField(doc.fieldName);
            try {
                const response = await axios.patch(
                    route("deals.gathering.inline_update", { id: deal.id }),
                    { type: doc.updateType, data: { [doc.fieldName]: null } },
                    { headers: { Accept: "application/json" } },
                );

                if (
                    response.data?.status === "success" &&
                    response.data?.data
                ) {
                    setDeal(response.data.data);
                    message.success(
                        t("pages.deals.workspace.documents.delete_success"),
                    );
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
                setDeletingField(null);
            }
        },
        [deal.id, setDeal, t],
    );

    return {
        uploadToSlot,
        deleteSlot,
        canEdit,
        isUploadingField: (fieldName?: string) =>
            Boolean(fieldName) && uploadingField === fieldName,
        isDeletingField: (fieldName?: string) =>
            Boolean(fieldName) && deletingField === fieldName,
    };
}
