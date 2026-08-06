/**
 * Custom-field `required` is a completion-count signal only — it does not
 * gate saving. When any visible field in a section/category is required,
 * the sidebar X/Y badge counts only those required fields; otherwise it
 * falls back to counting every visible (non-file) field.
 */

export function isCustomFieldRequired(
    field: { required?: boolean | string | number } | null | undefined,
): boolean {
    if (field == null) return false;
    const value = field.required;
    return value === true || value === "yes" || value === 1 || value === "1";
}

/**
 * Pick which fields feed a completion badge.
 * - Any required among `visibleFields` → only those required fields
 * - None required → all visible fields (legacy behaviour)
 */
export function selectFieldsForCompletionCount<T extends { required?: boolean | string | number }>(
    visibleFields: T[],
): T[] {
    const requiredFields = visibleFields.filter(isCustomFieldRequired);
    return requiredFields.length > 0 ? requiredFields : visibleFields;
}
