import type { AnalysisScriptItem } from "../types/analysisTypes";
import type { AnalysisSection, AnalysisSectionItem } from "../types/analysisTypes";

/**
 * Converts the flat AnalysisScriptItem[] from the backend into grouped AnalysisSection[].
 *
 * Grouping rule — two item types open a section:
 * - `section` starts a hand-built section; the items after it are its contents
 * - `custom_field_category` starts a section that auto-expands to every field in
 *   that category, and takes no explicit contents of its own
 * Items appearing before either go into a fallback "General" section.
 */
export function adaptScriptItems(items: AnalysisScriptItem[]): AnalysisSection[] {
    const sections: AnalysisSection[] = [];
    let current: AnalysisSection | null = null;

    for (const item of items) {
        if (item.type === "custom_field_category") {
            current = {
                id: `cat_${item.id}`,
                title: item.label_override || item.item_key,
                guideText: item.guide_text ?? undefined,
                kind: "category",
                categoryId: parseInt(item.item_key, 10),
                items: [],
            };
            sections.push(current);
        } else if (item.type === "section") {
            current = {
                id: `sec_${item.id}`,
                title: item.label_override || "Untitled section",
                guideText: item.guide_text ?? undefined,
                kind: "custom",
                categoryId: null,
                items: [],
            };
            sections.push(current);
        } else {
            // Ensure there is a section to add to
            if (!current) {
                current = {
                    id: "general",
                    title: "General",
                    guideText: undefined,
                    kind: "custom",
                    categoryId: null,
                    items: [],
                };
                sections.push(current);
            }

            const kind = item.type as AnalysisSectionItem["kind"];
            const sectionItem: AnalysisSectionItem = { kind, scriptItem: item };
            current.items.push(sectionItem);
        }
    }

    return sections;
}
