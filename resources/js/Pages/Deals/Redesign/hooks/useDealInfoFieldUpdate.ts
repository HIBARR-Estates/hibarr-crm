import { useCallback, useState } from "react";
import { usePage } from "@inertiajs/react";
import axios from "axios";
import { message } from "antd";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiResponse } from "@/lib/api/types";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import useTranslation from "@/Hooks/useTranslation";
import { useCurrencies } from "@/Hooks/useFormData";
import type { Deal } from "@/Types/api/deals";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

const HIBARR_FIELD_NAMES = [
    "interested_in",
    "budget_range",
    "purchase_timeline",
    "motivation",
    "strategy_meeting_booked",
    "downpayment_paid",
    "inspection_trip_date",
    "deposit_confirmation",
    "reservation_agreement",
    "sales_contract",
    "message",
] as const;

type UpdateType = "details" | "contact" | "custom_field" | "hibarr_field" | "recalculate_value";
type ExplicitUpdateType = "details" | "contact" | "custom_field" | "hibarr_field";

/**
 * Kill-switch shared with useAnalysisFieldSave.ts. On: a changed "custom_field"
 * group is sent to the dedicated bulk endpoint instead of inline-update. This
 * tab has no "lead_custom_field" case in its type union today, so this can't
 * yet collapse a request the way the analysis modal's coalescing does — it's
 * wired up so a deal-only custom field save already goes through the same
 * path the analysis modal uses, and so that adding lead fields to this tab
 * later (a separate, not-yet-done change) benefits immediately without
 * touching this call site again.
 */
const CUSTOM_FIELDS_BULK_FLAG = "crm.custom-fields-bulk-write";

export interface DealFieldChange {
    fieldName: string;
    value: unknown;
    type?: ExplicitUpdateType;
}

export default function useDealInfoFieldUpdate() {
    const { deal, setDeal } = useDealWorkspace();
    const [updatingField, setUpdatingField] = useState<string | null>(null);
    const [isRecalculatingValue, setIsRecalculatingValue] = useState(false);
    const { props } = usePage<any>();
    const bulkWriteEnabled = props.featureFlags?.[CUSTOM_FIELDS_BULK_FLAG] === true;
    const { currencies } = useCurrencies();
    const defaultCurrencyCode = props.default_currency_code || "TRY";
    const { t } = useTranslation();
    const dealPermissions = useDealPermissions(deal);

    const { mutateAsync: updateDeal } = useApiMutate<
        { type: UpdateType; data: Record<string, unknown> },
        Deal,
        ApiResponse<Deal>
    >(
        route("deals.gathering.inline_update", { id: deal.id }),
        "PATCH",
        (response) => {
            if (response?.status === "success" && response?.data) {
                setDeal(response.data);
            }
            setUpdatingField(null);
        },
    );

    const isFieldLoading = useCallback(
        (fieldName: string) => updatingField === fieldName,
        [updatingField],
    );

    const resolveUpdateType = useCallback(
        (
            fieldName: string,
            explicit?: "details" | "contact" | "custom_field" | "hibarr_field",
        ): "details" | "contact" | "custom_field" | "hibarr_field" => {
            if (explicit) return explicit;
            if (["email", "mobile", "company_name"].includes(fieldName)) {
                return "contact";
            }
            if (fieldName.startsWith("field_")) return "custom_field";
            if (
                HIBARR_FIELD_NAMES.includes(
                    fieldName as (typeof HIBARR_FIELD_NAMES)[number],
                )
            ) {
                return "hibarr_field";
            }
            return "details";
        },
        [],
    );

    // Turn one field change into { updateType, api-payload entries }. A
    // currency object expands into currency_id + amount (both "details").
    // Shared by the single-field and batched-save paths so the transforms
    // (email→client_email, currency split, close_date null) live in one place.
    const buildFieldEntries = useCallback(
        (
            fieldName: string,
            value: unknown,
            explicitType?: ExplicitUpdateType,
        ): { type: ExplicitUpdateType; entries: Record<string, unknown> } => {
            const type = resolveUpdateType(fieldName, explicitType);

            if (
                (fieldName === "value" || fieldName === "manual_value") &&
                value &&
                typeof value === "object" &&
                ("amount" in value || "currency" in value)
            ) {
                const currencyCode =
                    typeof (value as { currency?: string }).currency === "string"
                        ? (value as { currency: string }).currency
                        : defaultCurrencyCode;
                const foundCurrency = currencies.find(
                    (currency: { currency_code?: string; id?: number }) =>
                        (currency.currency_code || "").toUpperCase() ===
                        currencyCode.toUpperCase(),
                );
                const entries: Record<string, unknown> = {};
                if (foundCurrency?.id) entries.currency_id = foundCurrency.id;
                const amount = (value as { amount?: unknown }).amount;
                if (amount !== null && amount !== undefined && amount !== "") {
                    entries[fieldName] = Number(amount);
                } else if (fieldName === "manual_value") {
                    entries.manual_value = null;
                }
                return { type: "details", entries };
            }

            let apiFieldName = fieldName;
            let processedValue: unknown = value;
            if (fieldName === "email") {
                apiFieldName = "client_email";
            } else if (fieldName === "value" || fieldName === "manual_value") {
                processedValue = value ? parseFloat(String(value)) : 0;
            } else if (fieldName === "close_date") {
                processedValue = value || null;
            }
            return { type, entries: { [apiFieldName]: processedValue } };
        },
        [currencies, defaultCurrencyCode, resolveUpdateType],
    );

    // Group N field changes by update type — the endpoint already accepts
    // every field of a type in a single `data` map, so a whole edit-mode save
    // is 1–3 requests, not one per field.
    const applyGroupedUpdates = useCallback(
        async (changes: DealFieldChange[]): Promise<void> => {
            const grouped: Partial<
                Record<ExplicitUpdateType, Record<string, unknown>>
            > = {};
            for (const { fieldName, value, type } of changes) {
                const { type: groupType, entries } = buildFieldEntries(
                    fieldName,
                    value,
                    type,
                );
                if (Object.keys(entries).length === 0) continue;
                grouped[groupType] = { ...(grouped[groupType] ?? {}), ...entries };
            }

            const groups = Object.entries(grouped)
                .filter(([, data]) => data && Object.keys(data).length > 0)
                .map(([groupType, data]) => ({
                    type: groupType as ExplicitUpdateType,
                    data: data as Record<string, unknown>,
                }));

            if (groups.length === 0) return;

            // One type → the single response is authoritative.
            if (groups.length === 1) {
                const [group] = groups;

                // Deal custom fields go through the dedicated bulk endpoint
                // when enabled (see CUSTOM_FIELDS_BULK_FLAG above) — same
                // write path the analysis modal uses, no lead data here since
                // this tab can't produce a "lead_custom_field" group today.
                if (bulkWriteEnabled && group.type === "custom_field") {
                    const response = await axios.patch(
                        route("deals.gathering.custom_fields_bulk", { id: deal.id }),
                        { deal: group.data },
                        { headers: { Accept: "application/json" } },
                    );
                    if (response.data?.status === "success" && response.data?.data) {
                        setDeal(response.data.data);
                    }
                    setUpdatingField(null);
                    return;
                }

                // reuse updateDeal so its onSuccess (setDeal + clearing
                // updatingField) runs. This is also the path every
                // single-field inline edit takes.
                await updateDeal(group);
                return;
            }

            // Multiple types → fire concurrently. Each write returns a full
            // deal snapshot, so letting each response setDeal() would race and
            // could drop another group's changes. Instead we suppress the
            // per-response setDeal (raw axios, not updateDeal), wait for every
            // write to commit, then do one refresh for the authoritative,
            // fully-merged snapshot — same rich shape updateDeal returns.
            // (The custom_field group alone routes to the bulk endpoint when
            // enabled — the refresh is still needed either way here, since
            // details/contact/hibarr_field aren't things that endpoint
            // understands and can't be folded into the same request.)
            await Promise.all(
                groups.map((group) => {
                    if (bulkWriteEnabled && group.type === "custom_field") {
                        return axios.patch(
                            route("deals.gathering.custom_fields_bulk", { id: deal.id }),
                            { deal: group.data },
                            { headers: { Accept: "application/json" } },
                        );
                    }
                    return axios.patch(
                        route("deals.gathering.inline_update", { id: deal.id }),
                        group,
                        { headers: { Accept: "application/json" } },
                    );
                }),
            );
            const refreshed = await axios.get(
                route("deals.refresh", deal.id),
            );
            if (
                refreshed.data?.status === "success" &&
                refreshed.data?.data
            ) {
                setDeal(refreshed.data.data);
            }
        },
        [bulkWriteEnabled, buildFieldEntries, deal.id, setDeal, updateDeal],
    );

    // Public batched save — one request per changed type (see above).
    const handleFieldsUpdate = useCallback(
        (changes: DealFieldChange[]): Promise<void> =>
            applyGroupedUpdates(changes),
        [applyGroupedUpdates],
    );

    const handleFieldUpdate = useCallback(
        async (
            fieldName: string,
            value: unknown,
            type?: "details" | "contact" | "custom_field" | "hibarr_field",
        ): Promise<void> => {
            setUpdatingField(fieldName);

            const isFile = value instanceof File;
            const isFileArray =
                Array.isArray(value) &&
                value.length > 0 &&
                value[0] instanceof File;
            const effectiveType = resolveUpdateType(fieldName, type);

            try {
                if (
                    (isFile || isFileArray) &&
                    (effectiveType === "custom_field" ||
                        effectiveType === "hibarr_field")
                ) {
                    const formData = new FormData();
                    formData.append("_method", "PATCH");
                    formData.append("type", effectiveType);

                    if (isFileArray) {
                        (value as File[]).forEach((file, index) => {
                            formData.append(
                                `data[${fieldName}][${index}]`,
                                file,
                            );
                        });
                    } else if (isFile) {
                        formData.append(`data[${fieldName}]`, value as File);
                    }

                    const response = await axios.post(
                        route("deals.gathering.inline_update", {
                            id: deal.id,
                        }),
                        formData,
                        { headers: { Accept: "application/json" } },
                    );

                    if (
                        response.data?.status === "success" &&
                        response.data?.data
                    ) {
                        setDeal(response.data.data);
                        message.success(t("pages.deals.info.file_upload_success"));
                    }
                    setUpdatingField(null);
                    return;
                }

                await applyGroupedUpdates([{ fieldName, value, type }]);
            } catch {
                setUpdatingField(null);
                throw new Error("field_update_failed");
            }
        },
        [applyGroupedUpdates, deal.id, resolveUpdateType, setDeal, t],
    );

    const handleRecalculateValue = useCallback(async () => {
        setIsRecalculatingValue(true);
        setUpdatingField("value_recalculate");
        try {
            await updateDeal({ type: "recalculate_value", data: {} });
            message.success(t("pages.deals.info.recalculate_success"));
        } catch (error: unknown) {
            message.error(
                (error as { message?: string })?.message ||
                    t("pages.deals.info.recalculate_error"),
            );
        } finally {
            setIsRecalculatingValue(false);
            setUpdatingField(null);
        }
    }, [t, updateDeal]);

    return {
        deal,
        canEdit: dealPermissions.canEdit,
        canDelete: dealPermissions.canDelete,
        isLocked: dealPermissions.isLocked,
        updatingField,
        isFieldLoading,
        isRecalculatingValue,
        handleFieldUpdate,
        handleFieldsUpdate,
        handleRecalculateValue,
    };
}
