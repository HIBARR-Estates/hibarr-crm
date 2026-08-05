import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import type { Lead } from "@/Types/api/leads";
import { formatMobileForDisplay } from "@/lib/utils";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";

/**
 * Inline single-field writes for the lead dossier / edit modal.
 * Patches LeadWorkspaceContext from the response — no page reload.
 */
export default function useLeadFieldUpdate() {
    const { lead, setLead } = useLeadWorkspace();
    const [updatingField, setUpdatingField] = useState<string | null>(null);

    const updateField = useCallback(
        async (fieldName: string, value: unknown): Promise<void> => {
            setUpdatingField(fieldName);
            try {
                const response = await axios.patch(
                    route("lead-contact.patch", { lead_contact: lead.id }),
                    { [fieldName]: value },
                    { headers: { Accept: "application/json" } },
                );

                const updated = response.data?.data?.lead as
                    | Record<string, unknown>
                    | undefined;

                if (response.data?.status !== "success" || !updated) {
                    throw new Error(
                        response.data?.message || "Failed to save change",
                    );
                }

                setLead((prev) => {
                    const next = { ...prev } as Record<string, unknown>;
                    Object.entries(updated).forEach(([key, val]) => {
                        if (val === undefined) return;
                        next[key] =
                            (key === "languages" ||
                                key === "categories" ||
                                key === "category_ids") &&
                            !Array.isArray(val)
                                ? []
                                : val;
                    });

                    // Normalize lifecycle relation keys from the patch response.
                    const lifecycle =
                        updated.lead_lifecycle_status ??
                        updated.lifecycleStatus;
                    if (lifecycle != null) {
                        next.lead_lifecycle_status = lifecycle;
                        next.lifecycleStatus = lifecycle;
                    }

                    if (updated.mobile !== undefined) {
                        const formatted = formatMobileForDisplay(
                            updated.mobile as string,
                        );
                        next.mobile_with_phonecode =
                            formatted && formatted !== "--" ? formatted : "--";
                    }
                    if (updated.office !== undefined) {
                        const formatted = formatMobileForDisplay(
                            updated.office as string,
                        );
                        next.office_phone_formatted =
                            formatted && formatted !== "--"
                                ? formatted
                                : (updated.office as string) || "--";
                    }

                    return next as unknown as Lead;
                });
            } catch (error: unknown) {
                const detail =
                    (error as { response?: { data?: { message?: string } } })
                        ?.response?.data?.message ||
                    (error as Error)?.message ||
                    "Failed to save change";
                message.error(detail);
                throw error;
            } finally {
                setUpdatingField(null);
            }
        },
        [lead.id, setLead],
    );

    const updateCustomField = useCallback(
        async (fieldName: string, value: unknown): Promise<void> => {
            setUpdatingField(fieldName);
            try {
                await updateField("custom_fields", { [fieldName]: value });
            } finally {
                setUpdatingField(null);
            }
        },
        [updateField],
    );

    return { updateField, updateCustomField, updatingField };
}
