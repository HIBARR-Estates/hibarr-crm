import type { Deal } from "@/Types/api/deals";

/** Mirrors FieldResolverService hibarr field list. */
const HIBARR_FIELDS = new Set([
    "interested_in",
    "motivation",
    "purchase_timeline",
    "budget_range",
    "message",
    "strategy_meeting_booked",
    "downpayment_paid",
    "inspection_trip_date",
    "deposit_confirmation",
    "reservation_agreement",
    "sales_contract",
]);

export interface StageRequirementCondition {
    field: string;
    label?: string;
    operator: string;
    /** Human-readable value for display (may be Yes/No, option labels). */
    value: unknown;
    /** Unformatted stored condition value for evaluation. */
    raw_value?: unknown;
}

/**
 * Resolve a deal automation field path from the live deal object
 * (FieldResolverService client-side mirror for read-only UI checks).
 */
export function resolveDealFieldValue(deal: Deal, field: string): unknown {
    const base = field.includes(".")
        ? field.slice(field.lastIndexOf(".") + 1)
        : field;

    if (HIBARR_FIELDS.has(base)) {
        const hibarr =
            deal.hibarr_fields ??
            (deal as { hibarrFields?: Deal["hibarr_fields"] }).hibarrFields;
        return hibarr?.[base as keyof NonNullable<Deal["hibarr_fields"]>];
    }

    if (base.startsWith("custom_field_")) {
        const id = base.replace("custom_field_", "");
        const data = deal.custom_fields_data;
        if (!data) return null;
        return (
            data[`field_${id}`] ??
            data[id] ??
            data[Number(id)] ??
            null
        );
    }

    // Follow-up aggregates aren't on the deal shape for the redesign page.
    if (
        base.startsWith("followup_") ||
        base.startsWith("last_followup_") ||
        base.startsWith("next_followup_")
    ) {
        return null;
    }

    return (deal as unknown as Record<string, unknown>)[base] ?? null;
}

/** PHP empty()-like check used by ConditionEvaluatorService for `exists`. */
function isEmptyLike(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (value === false) return true;
    if (value === 0 || value === 0.0) return true;
    if (value === "0" || value === "") return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "object") {
        return Object.keys(value as object).length === 0;
    }
    return false;
}

function normalizeCompareValue(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value === "Yes" || value === "yes" || value === "true" || value === "TRUE") {
        return 1;
    }
    if (value === "No" || value === "no" || value === "false" || value === "FALSE") {
        return 0;
    }
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed !== "" && !Number.isNaN(Number(trimmed))) {
            return Number(trimmed);
        }
        return trimmed;
    }
    return value;
}

function valuesEqual(a: unknown, b: unknown): boolean {
    const na = normalizeCompareValue(a);
    const nb = normalizeCompareValue(b);
    // Loose equality mirrors PHP's == in ConditionEvaluatorService.
    return na == nb;
}

/**
 * Whether a stage-requirement condition is currently satisfied on the deal.
 * Mirrors DealAutomationService + ConditionEvaluatorService (AND per condition).
 */
export function isStageRequirementMet(
    deal: Deal,
    condition: StageRequirementCondition,
): boolean {
    const resolved = resolveDealFieldValue(deal, condition.field);
    const operator = condition.operator;
    const expected =
        condition.raw_value !== undefined ? condition.raw_value : condition.value;

    if (operator === "exists") {
        return !isEmptyLike(resolved);
    }

    // Needs previous value; never claim met from a static snapshot.
    if (operator === "changed") {
        return false;
    }

    const left = normalizeCompareValue(resolved);
    const right = normalizeCompareValue(expected);

    switch (operator) {
        case "=":
            return valuesEqual(resolved, expected);
        case ">":
            return left != null && right != null && (left as number) > (right as number);
        case "<":
            return left != null && right != null && (left as number) < (right as number);
        case "contains": {
            if (Array.isArray(resolved)) {
                return resolved.some((item) => valuesEqual(item, expected));
            }
            return String(resolved ?? "").includes(String(expected ?? ""));
        }
        default:
            return false;
    }
}
