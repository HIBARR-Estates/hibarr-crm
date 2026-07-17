import type { EntitySummaryChip } from "@/Types/entity-summary";

interface EntityAiSummaryChipGridProps {
    chips: EntitySummaryChip[];
}

export default function EntityAiSummaryChipGrid({
    chips,
}: EntityAiSummaryChipGridProps) {
    return (
        <div className="entity-ai-summary-chip-grid">
            {chips.map((chip) => (
                <article key={chip.id} className="entity-ai-summary-chip">
                    <p className="entity-ai-summary-chip__label">{chip.label}</p>
                    <p className="entity-ai-summary-chip__value">
                        <span
                            className={`entity-ai-summary-chip__dot entity-ai-summary-chip__dot--${chip.tone}`}
                        />
                        {chip.value}
                    </p>
                    <p className="entity-ai-summary-chip__sublabel">{chip.sublabel}</p>
                </article>
            ))}
        </div>
    );
}
