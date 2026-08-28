/**
 * Merge-tag detection for the email template editor and automation builder.
 * Mirrors the same {{tag}} syntax DealAutomationService::renderTemplateText()
 * / EmailTemplate::resolveSampleTags() match server-side, so a tag flagged
 * (or missed) here matches what actually resolves at send time.
 */

import { EmailTemplate, VariableMapping } from "../types";
import { FieldOptionGroup } from "../config/builderFields";

const TAG_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Every distinct {{tag}} name referenced in a block of text, in first-seen order. */
export function extractMergeTags(text: string): string[] {
    const seen = new Set<string>();
    for (const match of text.matchAll(TAG_RE)) {
        seen.add(match[1]);
    }
    return [...seen];
}

/** Flatten a merge-tag/condition field group list down to its option values,
 * for an O(1) "is this field key valid" lookup. */
export function flattenFieldKeys(groups: FieldOptionGroup[]): Set<string> {
    return new Set(groups.flatMap((g) => g.options.map((o) => String(o.value))));
}

/**
 * {{tags}} used in a template's subject/preheader/body that won't resolve to
 * anything for a given automation — i.e. DealAutomationService::resolveTagValue()
 * would send them blank. A tag counts as connected when either:
 *   - it has an explicit variable mapping (a 'field' mapping whose target field
 *     is itself valid for this automation, or any 'cta_url' mapping — those
 *     always resolve to *something*, even if a mismatched target is null), or
 *   - unmapped, the tag name itself is a valid field key for this automation.
 *
 * `validGroups` should be `mergeTagGroups(subjectType, catalog)` — already
 * subject-type aware (a lead-subject automation only exposes Lead fields).
 */
export function findUnconnectedTags(
    template: Pick<EmailTemplate, "subject" | "preheader" | "body" | "variable_mappings">,
    validGroups: FieldOptionGroup[],
): string[] {
    const validKeys = flattenFieldKeys(validGroups);
    const mappingByVariable = new Map<string, VariableMapping>(
        (template.variable_mappings ?? []).map((m) => [m.variable, m]),
    );
    const tags = extractMergeTags(
        `${template.subject ?? ""} ${template.preheader ?? ""} ${template.body ?? ""}`,
    );

    return tags.filter((tag) => {
        const mapping = mappingByVariable.get(tag);
        if (mapping?.type === "cta_url") return false;
        const fieldKey = mapping?.field?.trim() || tag;
        return !validKeys.has(fieldKey);
    });
}
