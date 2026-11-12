import "./agent-qualify.css";

export interface OutcomeCardItem {
    key: string;
    title: string;
    description: string;
    /** The lifecycle status the outcome sets, by its configured label and colour. */
    status: { label: string; color: string } | null;
}

interface OutcomeCardsProps {
    items: OutcomeCardItem[];
    selected: string | null;
    onSelect: (key: string) => void;
}

/**
 * The four ways a qualification can end (canvas L7-08), as a two-column grid
 * of cards: the outcome, what it means, and a solid tag with the status it
 * moves the lead to. The chosen one is outlined in its status colour.
 */
export default function OutcomeCards({ items, selected, onSelect }: OutcomeCardsProps) {
    return (
        <div className="agent-qo__cards" role="radiogroup">
            {items.map((item) => {
                const on = item.key === selected;
                return (
                    <button
                        key={item.key}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className={`agent-qo__card${on ? " agent-qo__card--on" : ""}`}
                        style={item.status ? ({ "--outcome-color": item.status.color } as React.CSSProperties) : undefined}
                        onClick={() => onSelect(item.key)}
                    >
                        <span className="agent-qo__card-top">
                            <span className="agent-qo__card-title">{item.title}</span>
                            {item.status ? <span className="agent-qo__tag">→ {item.status.label}</span> : null}
                        </span>
                        <span className="agent-qo__card-desc">{item.description}</span>
                    </button>
                );
            })}
        </div>
    );
}
