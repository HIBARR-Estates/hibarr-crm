import { useTd } from "@/Hooks/useDynamicTranslation";
import type { EntitySummaryChip } from "@/Types/entity-summary";

interface EntityAiSummaryChipGridProps {
    chips: EntitySummaryChip[];
}

export default function EntityAiSummaryChipGrid({
    chips,
}: EntityAiSummaryChipGridProps) {
    const { td } = useTd();

    return (
        <div className="entity-ai-summary-chip-grid">
            {chips.map((chip) => (
                <article key={chip.id} className="entity-ai-summary-chip">
                    <p className="entity-ai-summary-chip__label">
                        {td(chip.label, { source: "en" })}
                    </p>
                    <p className="entity-ai-summary-chip__value">
                        <span
                            className={`entity-ai-summary-chip__dot entity-ai-summary-chip__dot--${chip.tone}`}
                        />
                        {td(chip.value, { source: "en" })}
                    </p>
                    <p className="entity-ai-summary-chip__sublabel">
                        {td(chip.sublabel, { source: "en" })}
                    </p>
                </article>
            ))}
        </div>
    );
}
