import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import type { Lead } from "@/Types/api/leads";
import {
    computeAgeFieldsFromDateOfBirth,
    computeAgeRangeFromAge,
} from "@/lib/leadAge";
import { formatMobileForDisplay } from "@/lib/utils";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";

export interface LeadFieldChange {
    fieldName: string;
    value: unknown;
    type?: "custom_field";
}

function isCustomFieldName(fieldName: string, type?: "custom_field"): boolean {
    return type === "custom_field" || fieldName.startsWith("field_");
}

function processStandardField(
    fieldName: string,
    value: unknown,
): Record<string, unknown> {
    if (fieldName === "value") {
        return {
            value:
                value === null || value === undefined || value === ""
                    ? null
                    : Number(value),
        };
    }

    if (
        fieldName === "currency_id" ||
        fieldName === "category_id" ||
        fieldName === "source_id" ||
        fieldName === "lead_owner" ||
        fieldName === "status_id" ||
        fieldName === "agent_id" ||
        fieldName === "lead_lifecycle_status_id"
    ) {
        return { [fieldName]: value ? Number(value) : null };
    }

    if (fieldName === "languages") {
        return { languages: Array.isArray(value) ? value : [] };
    }

    if (fieldName === "date_of_birth") {
        if (!value) {
            return {
                date_of_birth: null,
                age: null,
                age_range: null,
            };
        }
        const computed = computeAgeFieldsFromDateOfBirth(String(value));
        return {
            date_of_birth: String(value).split("T")[0],
            age: computed.age,
            age_range: computed.age_range,
        };
    }

    if (fieldName === "age") {
        const age =
            value === null || value === undefined || value === ""
                ? null
                : Number(value);
        return {
            age,
            age_range: computeAgeRangeFromAge(age),
        };
    }

    if (fieldName === "age_range") {
        return { age_range: value || null };
    }

    if (fieldName === "gender" || fieldName === "salutation") {
        return { [fieldName]: value || null };
    }

    if (fieldName === "email") {
        return { client_email: value || null };
    }

    return { [fieldName]: value ?? null };
}

/**
 * Deal-info-shaped field updates for the Lead info tab:
 * single-field click-to-edit + batched Save All in section edit mode.
 */
export default function useLeadInfoFieldUpdate(canEdit = true) {
    const { lead, setLead } = useLeadWorkspace();
    const [updatingField, setUpdatingField] = useState<string | null>(null);

    const mergeLeadResponse = useCallback(
        (updated: Record<string, unknown>) => {
            setLead((prev) => {
                const next = { ...prev } as Record<string, unknown>;
                Object.entries(updated).forEach(([key, val]) => {
                    if (val === undefined) return;
                    next[key] =
                        key === "languages" && !Array.isArray(val) ? [] : val;
                });

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
        },
        [setLead],
    );

    const patchLead = useCallback(
        async (payload: Record<string, unknown>): Promise<void> => {
            const response = await axios.patch(
                route("lead-contact.patch", { lead_contact: lead.id }),
                payload,
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

            mergeLeadResponse(updated);
        },
        [lead.id, mergeLeadResponse],
    );

    const isFieldLoading = useCallback(
        (fieldName: string) => updatingField === fieldName,
        [updatingField],
    );

    const buildPayload = useCallback((changes: LeadFieldChange[]) => {
        const payload: Record<string, unknown> = {};
        const customFields: Record<string, unknown> = {};

        // Only a *set* DOB should drive age/age_range. Age-only edits still
        // include `date_of_birth: null` in the batch (LeadAgeFieldsGroup), and
        // treating that as a DOB change was wiping the age the user just set.
        const dobDrivesAge = changes.some((change) => {
            if (
                isCustomFieldName(change.fieldName, change.type) ||
                change.fieldName !== "date_of_birth"
            ) {
                return false;
            }
            if (change.value == null || change.value === "") {
                return false;
            }
            return String(change.value).trim() !== "";
        });

        for (const { fieldName, value, type } of changes) {
            if (isCustomFieldName(fieldName, type)) {
                customFields[fieldName] = value;
                continue;
            }
            if (
                dobDrivesAge &&
                (fieldName === "age" || fieldName === "age_range")
            ) {
                continue;
            }
            Object.assign(payload, processStandardField(fieldName, value));
        }

        if (Object.keys(customFields).length > 0) {
            payload.custom_fields = customFields;
        }

        return payload;
    }, []);

    const handleFieldsUpdate = useCallback(
        async (changes: LeadFieldChange[]): Promise<void> => {
            const payload = buildPayload(changes);
            if (Object.keys(payload).length === 0) return;
            await patchLead(payload);
        },
        [buildPayload, patchLead],
    );

    const handleFieldUpdate = useCallback(
        async (
            fieldName: string,
            value: unknown,
            type?: "custom_field",
        ): Promise<void> => {
            setUpdatingField(fieldName);
            try {
                await handleFieldsUpdate([{ fieldName, value, type }]);
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
        [handleFieldsUpdate],
    );

    return {
        lead,
        canEdit,
        updatingField,
        isFieldLoading,
        handleFieldUpdate,
        handleFieldsUpdate,
    };
}
