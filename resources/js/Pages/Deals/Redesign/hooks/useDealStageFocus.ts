import { useMemo } from "react";
import type { Deal } from "@/Types/api/deals";

export interface StageFocusFieldItem {
    key: string;
    label: string;
    value: string | null;
    isMissing: boolean;
}

interface CustomFieldDefinition {
    id: number;
    label?: string;
    name?: string;
    type?: string;
    required?: boolean | string;
}

interface TrackedField {
    key: string;
    label: string;
    getValue: (deal: Deal) => unknown;
    format?: (value: unknown) => string | null;
}

function formatPrimitive(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return String(value);
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed || null;
    }
    if (Array.isArray(value)) {
        return value.length > 0 ? value.join(", ") : null;
    }
    return String(value);
}

function isMissingValue(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === "boolean") return value === false;
    if (typeof value === "string") return !value.trim();
    if (typeof value === "number") return false;
    if (Array.isArray(value)) return value.length === 0;
    return !value;
}

const CORE_TRACKED_FIELDS: TrackedField[] = [
    {
        key: "interested_in",
        label: "Primary interest",
        getValue: (deal) => deal.hibarr_fields?.interested_in,
    },
    {
        key: "budget_range",
        label: "Budget range",
        getValue: (deal) => deal.hibarr_fields?.budget_range,
    },
    {
        key: "purchase_timeline",
        label: "Purchase timeline",
        getValue: (deal) => deal.hibarr_fields?.purchase_timeline,
    },
    {
        key: "motivation",
        label: "Motivation",
        getValue: (deal) => deal.hibarr_fields?.motivation,
    },
    {
        key: "strategy_meeting_booked",
        label: "Strategy meeting booked",
        getValue: (deal) => deal.hibarr_fields?.strategy_meeting_booked,
        format: (value) => (value === true ? "Yes" : null),
    },
    {
        key: "downpayment_paid",
        label: "Downpayment paid",
        getValue: (deal) => deal.hibarr_fields?.downpayment_paid,
        format: (value) => (value === true ? "Yes" : null),
    },
    {
        key: "inspection_trip_date",
        label: "Inspection trip date",
        getValue: (deal) => deal.hibarr_fields?.inspection_trip_date,
    },
    {
        key: "deal_value",
        label: "Deal value",
        getValue: (deal) => deal.value,
    },
    {
        key: "close_date",
        label: "Close date",
        getValue: (deal) => deal.close_date,
    },
    {
        key: "packages",
        label: "Package selected",
        getValue: (deal) => deal.packages?.map((pkg) => pkg.name).filter(Boolean),
        format: (value) =>
            Array.isArray(value) && value.length > 0 ? value.join(", ") : null,
    },
];

export default function useDealStageFocus(
    deal: Deal,
    customFields: CustomFieldDefinition[] = [],
) {
    return useMemo(() => {
        const stageFocusByStage = (
            deal as Deal & {
                stage_focus?: Record<string, string[]>;
            }
        ).stage_focus;
        const stageKey = deal.lead_stage?.slug || String(deal.lead_stage?.id ?? "");
        const stageSpecificKeys =
            stageKey && stageFocusByStage?.[stageKey]
                ? new Set(stageFocusByStage[stageKey])
                : null;

        const customTracked: TrackedField[] = customFields
            .filter((field) => field.type !== "file")
            .map((field) => ({
                key: `custom_${field.id}`,
                label: field.label?.trim() || field.name?.trim() || `Field ${field.id}`,
                getValue: (currentDeal) =>
                    currentDeal.custom_fields_data?.[`field_${field.id}`] ??
                    currentDeal.custom_fields_data?.[field.id],
            }));

        const tracked = [...CORE_TRACKED_FIELDS, ...customTracked].filter((field) => {
            if (!stageSpecificKeys) return true;
            return stageSpecificKeys.has(field.key);
        });

        const evaluated: StageFocusFieldItem[] = tracked.map((field) => {
            const raw = field.getValue(deal);
            const formatted = field.format ? field.format(raw) : formatPrimitive(raw);
            return {
                key: field.key,
                label: field.label,
                value: formatted,
                isMissing: isMissingValue(raw),
            };
        });

        const missingItems = evaluated.filter((item) => item.isMissing).slice(0, 6);
        const filledCount = evaluated.filter((item) => !item.isMissing).length;
        const totalCount = evaluated.length;
        const completionPercent =
            totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

        return {
            stageName: deal.lead_stage?.name ?? "Current stage",
            pipelineName: deal.pipeline?.name ?? null,
            hasStageFocusMapping: Boolean(stageSpecificKeys && stageSpecificKeys.size > 0),
            missingItems,
            filledCount,
            totalCount,
            completionPercent,
            previewItems: evaluated.slice(0, 6),
        };
    }, [customFields, deal]);
}
