import type { RailSectionGroup } from "@/Pages/Deals/Redesign/components/analysis/analysisRailItems";
import type { KeyFactGroup } from "../contact/model";

/** One tile per analysis section at most, then the deal's own budget tile: 2 + 4 + 1 = the board's seven. */
const MAX_SECTION_TILES = 4;
const MAX_LINES = 3;

interface BudgetInput {
    /** The deal's value, formatted; empty when the deal has none. */
    value: string;
    /** "Deal value € 7,700", shown under the budget range. */
    valueLine: string;
    /** hibarr budget_range, when the company fills it in. */
    budgetRange: string;
    /** "Close date 30 Jan", empty when none. */
    closeLine: string;
    /** Attached packages, by name. */
    packages: string[];
}

/**
 * The deal page's key facts (canvas L7-10): how to reach them and who they
 * are (from the person), the answers captured in the deal's analysis, section
 * by section in the company's own script order, and the deal's budget and
 * value. A section nobody has answered yet is shown once, as needing input.
 * Nothing here is invented: every line is a stored value.
 */
export function buildDealFacts(
    base: KeyFactGroup[],
    railGroups: RailSectionGroup[],
    budget: BudgetInput,
    notAsked: string,
): KeyFactGroup[] {
    const person = base.filter((group) => group.id === "reach" || group.id === "who");

    const sections: KeyFactGroup[] = [];
    let unansweredShown = false;
    for (const group of railGroups) {
        if (sections.length >= MAX_SECTION_TILES) break;
        if (group.steps.length === 0) continue;
        const answers = group.steps.filter((step) => step.filled && step.value).map((step) => step.value);
        if (answers.length > 0) {
            sections.push({
                id: `section-${group.sectionId}`,
                label: group.sectionTitle,
                lead: answers[0],
                lines: answers.slice(1, MAX_LINES),
            });
        } else if (!unansweredShown) {
            unansweredShown = true;
            sections.push({ id: `section-${group.sectionId}`, label: group.sectionTitle, lead: notAsked, lines: [], empty: true });
        }
    }

    const lead = budget.budgetRange || budget.value;
    const lines = [budget.budgetRange ? budget.valueLine : "", budget.closeLine, budget.packages.join(" + ")].filter(Boolean);
    const money: KeyFactGroup = { id: "budget_value", lead, lines };

    return [...person, ...sections, money];
}
