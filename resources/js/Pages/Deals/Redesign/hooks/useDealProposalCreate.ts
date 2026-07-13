import { useCallback, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import dayjs from "dayjs";
import { message } from "antd";
import type { Deal } from "@/Types/api/deals";

export interface DealProposalCreateInput {
    property: string;
    amount: string;
    notes?: string;
}

function mapPhpToDayjsFormat(format: string): string {
    const replacements: Record<string, string> = {
        d: "DD",
        D: "ddd",
        j: "D",
        l: "dddd",
        N: "E",
        S: "Do",
        w: "d",
        z: "DDD",
        W: "W",
        F: "MMMM",
        m: "MM",
        M: "MMM",
        n: "M",
        Y: "YYYY",
        y: "YY",
        a: "a",
        A: "A",
        g: "h",
        G: "H",
        h: "hh",
        H: "HH",
        i: "mm",
        s: "ss",
    };

    return format
        .split("")
        .map((char) => replacements[char] || char)
        .join("");
}

function formatValidTillForApi(dateFormat: string): string {
    return dayjs().add(30, "days").format(mapPhpToDayjsFormat(dateFormat));
}

function parseAmount(value: string): number {
    const cleaned = value.replace(/[^0-9.]/g, "");
    return Number.parseFloat(cleaned) || 0;
}

export default function useDealProposalCreate(deal: Deal) {
    const { props } = usePage();
    const [errors, setErrors] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const createProposal = useCallback(
        (input: DealProposalCreateInput, onSuccess?: () => void) => {
            const property = input.property.trim();
            const amountValue = parseAmount(input.amount);

            const validationErrors: string[] = [];
            if (!property) {
                validationErrors.push("Property is required");
            }
            if (!amountValue) {
                validationErrors.push("Offer amount is required");
            }

            if (validationErrors.length > 0) {
                setErrors(validationErrors);
                return;
            }

            const company = props.company;
            const dateFormat = company?.date_format || "d-m-Y";
            const currencyId =
                deal.currency_id || deal.currency?.id || company?.currency_id || 1;

            const payload = {
                deal_id: deal.id,
                valid_till: formatValidTillForApi(dateFormat),
                currency_id: currencyId,
                calculate_tax: "after_discount",
                description: property,
                note: input.notes?.trim() || "",
                require_signature: 1,
                discount_type: "fixed",
                discount_value: 0,
                sub_total: amountValue,
                total: amountValue,
                redirect_url: route("deals.show", deal.id),
                item_name: [property],
                item_summary: [""],
                type: ["item"],
                quantity: [1],
                cost_per_item: [amountValue],
                amount: [amountValue],
            };

            setErrors([]);
            setIsSaving(true);

            router.post(route("proposals.store"), payload, {
                preserveScroll: true,
                onSuccess: () => {
                    setIsSaving(false);
                    message.success("Offer saved");
                    onSuccess?.();
                    router.reload({ only: ["proposals"] });
                },
                onError: (responseErrors) => {
                    setIsSaving(false);
                    const flatErrors = Object.values(responseErrors || {}).flat();
                    setErrors(
                        flatErrors.length > 0
                            ? flatErrors.map(String)
                            : ["Failed to save offer"],
                    );
                },
                onFinish: () => setIsSaving(false),
            });
        },
        [deal, props.company],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        createProposal,
        isSaving,
        errors,
        clearErrors,
    };
}
