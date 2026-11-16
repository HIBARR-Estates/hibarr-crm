import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import { propertyLine, formatPrice, humanize } from "./format";
import type { PortfolioProperty, Recommendation } from "./types";

interface PropertyCardProps {
    property: PortfolioProperty | Recommendation;
    /** Label for the construction status chip over the photo (configured label, else a tidied value). */
    statusLabel?: string;
    selected?: boolean;
    onSelect?: (id: number) => void;
    onExpose: (property: PortfolioProperty) => void;
}

function isRecommendation(property: PortfolioProperty | Recommendation): property is Recommendation {
    return "match" in property;
}

/** Colour of the match dot: green from 80, blue from 60, grey under (the design's three tones). */
function matchTone(score: number): "high" | "mid" | "low" {
    return score >= 80 ? "high" : score >= 60 ? "mid" : "low";
}

/**
 * One listing (L7-18, L7-19): photo with its construction status, title,
 * where it is, price and the Exposé button. With a match score it also lists
 * why it matches. The card is a toggle when it can be selected (For my deals).
 */
export default function PropertyCard({ property, statusLabel, selected = false, onSelect, onExpose }: PropertyCardProps) {
    const { t, locale } = useTranslation();
    const selectable = onSelect !== undefined;
    const rec = isRecommendation(property) ? property : null;

    const body = (
        <>
            <span className="agent-pf__photo">
                {property.photo ? <img src={property.photo} alt="" loading="lazy" decoding="async" /> : <Icon name="building" size={28} />}
                {property.construction_status ? (
                    <span className="agent-pf__photo-tag">{statusLabel || humanize(property.construction_status)}</span>
                ) : null}
            </span>
            <span className="agent-pf__body">
                <b className="agent-pf__title">{property.title}</b>
                <span className="agent-pf__line">
                    {propertyLine(property, (count) => t("pages.agent_workspace.portfolio.card.beds", { count }))}
                </span>
            </span>
        </>
    );

    return (
        <li className={`agent-pf__card${selected ? " is-selected" : ""}`}>
            {selectable ? (
                <button type="button" className="agent-pf__pick" aria-pressed={selected} onClick={() => onSelect(property.id)}>
                    {body}
                </button>
            ) : (
                <div className="agent-pf__pick agent-pf__pick--static">{body}</div>
            )}
            <div className="agent-pf__foot">
                <span className="agent-pf__price">{formatPrice(property.price, property.currency, locale)}</span>
                <Button size="sm" className="agent-btn-soft" icon={<Icon name="file-text" size={13} />} onClick={() => onExpose(property)}>
                    {t("pages.agent_workspace.portfolio.card.expose")}
                </Button>
            </div>
            {rec && (rec.match !== null || rec.factors.length > 0) ? (
                <ul className="agent-pf__chips">
                    {rec.match !== null ? (
                        <li className="agent-pf__chip">
                            <span className={`agent-pf__chip-dot agent-pf__chip-dot--${matchTone(rec.match)}`} aria-hidden="true" />
                            {t("pages.agent_workspace.portfolio.card.match", { score: rec.match })}
                        </li>
                    ) : null}
                    {rec.factors.map((factor) => (
                        <li key={factor.label} className="agent-pf__chip">
                            <span className="agent-pf__chip-dot agent-pf__chip-dot--factor" aria-hidden="true" />
                            {factor.label}
                        </li>
                    ))}
                </ul>
            ) : null}
        </li>
    );
}
