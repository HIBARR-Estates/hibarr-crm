import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { canEditLead } from "../adapters/leadEditAccess";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";
import type { LeadDocumentItem } from "./useLeadDocuments";

function extractBackendMessage(error: unknown): string | undefined {
    if (!axios.isAxiosError(error)) return undefined;
    return (error.response?.data as { message?: string } | undefined)?.message;
}

/**
 * Upload / clear a file-typed lead custom field via lead-contact.patch.
 * Patches lead.custom_fields_data in workspace context — no Inertia reload.
 */
export default function useLeadDocumentUpload(
    editLeadPermission?: string | null,
) {
    const { lead, setLead } = useLeadWorkspace();
    const { td } = useTd();
    const { props } = usePage<PageProps>();
    const userId = props.auth?.user?.id;
    const [uploadingField, setUploadingField] = useState<string | null>(null);
    const [deletingField, setDeletingField] = useState<string | null>(null);

    const canEdit = canEditLead(editLeadPermission, lead, userId);

    const uploadToSlot = useCallback(
        async (doc: LeadDocumentItem, file: File) => {
            if (!doc.fieldName) return;

            setUploadingField(doc.fieldName);
            try {
                // POST + _method spoof: PHP does not parse multipart bodies on
                // PATCH, so the file never reaches LeadContactController::patch.
                const formData = new FormData();
                formData.append("_method", "PATCH");
                formData.append(`custom_fields[${doc.fieldName}]`, file);

                const response = await axios.post(
                    route("lead-contact.patch", { lead_contact: lead.id }),
                    formData,
                    { headers: { Accept: "application/json" } },
                );

                if (
                    response.data?.status === "success" &&
                    response.data?.data?.lead
                ) {
                    const payload = response.data.data.lead as {
                        custom_fields_data?: Record<string, unknown>;
                    };
                    setLead((prev) => ({
                        ...prev,
                        ...(payload.custom_fields_data !== undefined
                            ? { custom_fields_data: payload.custom_fields_data }
                            : {}),
                    }));
                    message.success(td("File uploaded", { source: "en" }));
                } else {
                    message.error(
                        response.data?.message ?? td("Upload failed", { source: "en" }),
                    );
                }
            } catch (error) {
                message.error(
                    extractBackendMessage(error) ?? td("Upload failed", { source: "en" }),
                );
            } finally {
                setUploadingField(null);
            }
        },
        [lead.id, setLead, td],
    );

    const deleteSlot = useCallback(
        async (doc: LeadDocumentItem) => {
            if (!doc.fieldName) return;

            setDeletingField(doc.fieldName);
            try {
                const response = await axios.patch(
                    route("lead-contact.patch", { lead_contact: lead.id }),
                    { custom_fields: { [doc.fieldName]: null } },
                    { headers: { Accept: "application/json" } },
                );

                if (
                    response.data?.status === "success" &&
                    response.data?.data?.lead
                ) {
                    const payload = response.data.data.lead as {
                        custom_fields_data?: Record<string, unknown>;
                    };
                    setLead((prev) => ({
                        ...prev,
                        ...(payload.custom_fields_data !== undefined
                            ? { custom_fields_data: payload.custom_fields_data }
                            : {}),
                    }));
                    message.success(td("File removed", { source: "en" }));
                } else {
                    message.error(
                        response.data?.message ?? td("Could not remove file", { source: "en" }),
                    );
                }
            } catch (error) {
                message.error(
                    extractBackendMessage(error) ??
                        td("Could not remove file", { source: "en" }),
                );
            } finally {
                setDeletingField(null);
            }
        },
        [lead.id, setLead, td],
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
