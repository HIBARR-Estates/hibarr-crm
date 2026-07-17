import { useCallback, useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import axios from "axios";
import { message } from "antd";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiResponse } from "@/lib/api/types";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import useTranslation from "@/Hooks/useTranslation";
import { useCurrencies } from "@/Hooks/useFormData";
import type { Deal } from "@/Types/api/deals";

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

export default function useDealInfoFieldUpdate(initialDeal: Deal) {
    const [deal, setDeal] = useState<Deal>(initialDeal);
    const [updatingField, setUpdatingField] = useState<string | null>(null);
    const [isRecalculatingValue, setIsRecalculatingValue] = useState(false);
    const { props } = usePage<any>();
    const { currencies } = useCurrencies();
    const defaultCurrencyCode = props.default_currency_code || "TRY";
    const { t } = useTranslation();
    const dealPermissions = useDealPermissions(deal);

    useEffect(() => {
        setDeal(initialDeal);
    }, [initialDeal]);

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

                let apiFieldName = fieldName;
                let processedValue = value;

                if (fieldName === "email") {
                    apiFieldName = "client_email";
                } else if (
                    fieldName === "value" ||
                    fieldName === "manual_value"
                ) {
                    if (
                        value &&
                        typeof value === "object" &&
                        ("amount" in value || "currency" in value)
                    ) {
                        const currencyCode =
                            typeof (value as { currency?: string }).currency ===
                            "string"
                                ? (value as { currency: string }).currency
                                : defaultCurrencyCode;
                        const foundCurrency = currencies.find(
                            (currency: { currency_code?: string; id?: number }) =>
                                (currency.currency_code || "").toUpperCase() ===
                                currencyCode.toUpperCase(),
                        );
                        const payloadData: Record<string, unknown> = {};
                        if (foundCurrency?.id) {
                            payloadData.currency_id = foundCurrency.id;
                        }
                        const amount = (value as { amount?: unknown }).amount;
                        if (
                            amount !== null &&
                            amount !== undefined &&
                            amount !== ""
                        ) {
                            payloadData[fieldName] = Number(amount);
                        } else if (fieldName === "manual_value") {
                            payloadData.manual_value = null;
                        }
                        if (Object.keys(payloadData).length === 0) {
                            setUpdatingField(null);
                            return;
                        }
                        await updateDeal({
                            type: "details",
                            data: payloadData,
                        });
                        return;
                    }
                    processedValue = value ? parseFloat(String(value)) : 0;
                } else if (fieldName === "close_date") {
                    processedValue = value || null;
                }

                await updateDeal({
                    type: effectiveType,
                    data: { [apiFieldName]: processedValue },
                });
            } catch {
                setUpdatingField(null);
                throw new Error("field_update_failed");
            }
        },
        [
            currencies,
            deal.id,
            defaultCurrencyCode,
            resolveUpdateType,
            t,
            updateDeal,
        ],
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
        handleRecalculateValue,
    };
}
