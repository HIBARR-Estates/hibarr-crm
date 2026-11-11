/**
 * Scroll a deal field into view and flash it, once the Deal info tab and
 * section it lives in have mounted. Custom fields mount later, so it retries
 * a few times. Field keys alias between `custom_field_12` and `field_12`.
 */
export function highlightDealField(fieldKey: string): void {
    const selectors = [
        `[data-deal-field="${CSS.escape(fieldKey)}"]`,
        `[data-field-key="${CSS.escape(fieldKey)}"]`,
    ];
    // custom_field_12 ↔ field_12 aliasing
    if (fieldKey.startsWith("custom_field_")) {
        const id = fieldKey.replace("custom_field_", "");
        selectors.push(
            `[data-field-key="field_${CSS.escape(id)}"]`,
            `[data-deal-field="field_${CSS.escape(id)}"]`,
        );
    } else if (fieldKey.startsWith("field_")) {
        const id = fieldKey.replace("field_", "");
        selectors.push(`[data-deal-field="custom_field_${CSS.escape(id)}"]`);
    }

    let attempts = 0;
    const tryHighlight = () => {
        attempts += 1;
        let el: Element | null = null;
        for (const sel of selectors) {
            el = document.querySelector(sel);
            if (el) break;
        }
        if (el instanceof HTMLElement) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("deal-field-flash");
            window.setTimeout(() => el?.classList.remove("deal-field-flash"), 1800);
            return;
        }
        if (attempts < 12) {
            window.setTimeout(tryHighlight, 80);
        }
    };
    window.setTimeout(tryHighlight, 60);
}
