import type { CustomField, ShowRuleSet } from "@/Types";

/**
 * Whether a lead custom field's visibility rules read deal context
 * ('pipeline' / 'pipeline_stage' sources) — the signal that this field's
 * value is resolved against a specific matching deal (see
 * useLeadCrossDealDocuments) rather than read straight off the lead.
 *
 * Both useLeadDocuments (lead-only fields) and useLeadCrossDealDocuments
 * (deal-context fields, resolved to one slot each) partition the same
 * field list off this one check, so a field is never double-counted as
 * both.
 */
export function hasDealContextRule(ruleSet: ShowRuleSet | null | undefined): boolean {
    if (!ruleSet) return false;

    const groups =
        ruleSet.groups && ruleSet.groups.length > 0
            ? ruleSet.groups
            : ruleSet.group
              ? [ruleSet.group]
              : [];

    return groups.some((group) =>
        (group.criteria ?? []).some(
            (criterion) =>
                criterion.reference_source === "pipeline" ||
                criterion.reference_source === "pipeline_stage",
        ),
    );
}

export function isPerDealFileField(field: {
    type?: string;
    show_rule_set?: CustomField["show_rule_set"];
}): boolean {
    return field.type === "file" && hasDealContextRule(field.show_rule_set);
}

/**
 * Splits a lead's file-typed custom fields into lead-level fields (read
 * straight off the lead) and deal-context fields (gated by pipeline/stage,
 * resolved against whichever matching deal holds the value).
 */
export function partitionLeadFileFields<
    F extends { type?: string; show_rule_set?: CustomField["show_rule_set"] },
>(fields: F[]): { leadLevel: F[]; perDeal: F[] } {
    const leadLevel: F[] = [];
    const perDeal: F[] = [];

    for (const field of fields) {
        if (field.type !== "file") continue;
        (isPerDealFileField(field) ? perDeal : leadLevel).push(field);
    }

    return { leadLevel, perDeal };
}
