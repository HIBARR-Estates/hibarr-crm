import type { AnalysisScriptItem } from "../types/analysisTypes";
import type { AnalysisSection, AnalysisSectionItem } from "../types/analysisTypes";

/**
 * Converts the flat AnalysisScriptItem[] from the backend into grouped AnalysisSection[].
 *
 * Grouping rule:
 * - custom_field_category items define section boundaries (one section per category)
 * - All subsequent items until the next custom_field_category belong to that section
 * - Items before the first custom_field_category go into a fallback "General" section
 */
export function adaptScriptItems(items: AnalysisScriptItem[]): AnalysisSection[] {
    const sections: AnalysisSection[] = [];
    let current: AnalysisSection | null = null;
    let questionNumber = 0;

    for (const item of items) {
        if (item.type === "custom_field_category") {
            questionNumber = 0;
            current = {
                id: String(item.id),
                title: item.label_override || item.item_key,
                guideText: item.guide_text ?? undefined,
                categoryId: parseInt(item.item_key, 10),
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
                    categoryId: null,
                    items: [],
                };
                sections.push(current);
            }

            const kind = item.type as AnalysisSectionItem["kind"];
            const sectionItem: AnalysisSectionItem = { kind, scriptItem: item };

            if (item.type === "question" || item.type === "native_field" || item.type === "hibarr_field" || item.type === "lead_field") {
                questionNumber += 1;
                sectionItem.number = questionNumber;
            }

            current.items.push(sectionItem);
        }
    }

    return sections;
}
