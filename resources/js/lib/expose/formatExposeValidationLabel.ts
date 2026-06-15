export interface ExposeValidationAction {
    type: "link";
    label: string;
    href: string;
}

export interface ExposeValidationWarning {
    severity: string;
    field: string;
    label?: string;
    message: string;
    action?: ExposeValidationAction;
}

export function formatExposeValidationLabel(
    warning: Pick<ExposeValidationWarning, "field" | "label">,
): string {
    if (warning.label) {
        return warning.label;
    }

    const leaf = warning.field.split(".").pop() ?? warning.field;

    return leaf
        .replace(/_/g, " ")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}
