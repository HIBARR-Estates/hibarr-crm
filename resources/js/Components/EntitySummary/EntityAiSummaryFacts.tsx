import {
    CalendarDays,
    Globe,
    House,
    Languages,
    MapPin,
    Target,
    Users,
    Wallet,
    type LucideIcon,
} from "lucide-react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { usePersonalize } from "./SummaryPersonalization";
import type {
    LeadSummaryFact,
    LeadSummaryFactKind,
} from "@/Types/entity-summary";

const FACT_ICONS: Record<LeadSummaryFactKind, LucideIcon> = {
    property: House,
    location: MapPin,
    budget: Wallet,
    timeline: CalendarDays,
    purpose: Target,
    decision_makers: Users,
    languages: Languages,
    based_in: Globe,
};

interface EntityAiSummaryFactsProps {
    facts: LeadSummaryFact[];
}

/**
 * The scan-line under the lead summary: icon + value, no visible labels. The
 * kind is still announced to screen readers.
 */
export default function EntityAiSummaryFacts({
    facts,
}: EntityAiSummaryFactsProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const personalize = usePersonalize();

    const known = facts.filter((fact) => fact.kind in FACT_ICONS && fact.value);

    if (known.length === 0) {
        return null;
    }

    return (
        <ul
            className="entity-ai-summary-facts"
            aria-label={t("pages.entity_summary.facts_label")}
        >
            {known.map((fact) => {
                const Icon = FACT_ICONS[fact.kind];

                return (
                    <li key={fact.kind} className="entity-ai-summary-facts__item">
                        <Icon
                            width={15}
                            height={15}
                            strokeWidth={2}
                            aria-hidden="true"
                            className="entity-ai-summary-facts__icon"
                        />
                        <span className="sr-only">
                            {t(`pages.entity_summary.fact_kind.${fact.kind}`)}:{" "}
                        </span>
                        {personalize(td(fact.value, { source: "en" }))}
                    </li>
                );
            })}
        </ul>
    );
}
