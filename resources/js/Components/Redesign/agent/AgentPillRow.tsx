import { useEffect, useRef, type KeyboardEvent } from "react";

export interface AgentPill<K extends string> {
    key: K;
    label: string;
    /** Optional status dot colour (a token value). */
    dot?: string;
}

interface AgentPillRowProps<K extends string> {
    pills: Array<AgentPill<K>>;
    active: K;
    onChange: (key: K) => void;
    ariaLabel: string;
    /**
     * Ties each pill to the panel it shows. The page renders the active panel
     * with `agentPillPanelProps(idPrefix, active)`.
     */
    idPrefix: string;
}

const tabId = (idPrefix: string, key: string) => `${idPrefix}-tab-${key}`;
const panelId = (idPrefix: string, key: string) => `${idPrefix}-panel-${key}`;

/** Props for the panel a pill controls, so assistive tech links the two. */
export function agentPillPanelProps(idPrefix: string, key: string) {
    return { id: panelId(idPrefix, key), role: "tabpanel" as const, "aria-labelledby": tabId(idPrefix, key), tabIndex: 0 };
}

/**
 * The second row of pills under the dock. Pills are client-side state that a
 * page keeps in its URL (no server round trip). On narrow screens the row
 * scrolls sideways and keeps the active pill in view. Arrow keys, Home and
 * End move between pills, as in any tab list.
 */
export default function AgentPillRow<K extends string>({ pills, active, onChange, ariaLabel, idPrefix }: AgentPillRowProps<K>) {
    const refs = useRef(new Map<K, HTMLButtonElement>());

    useEffect(() => {
        refs.current.get(active)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, [active]);

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const index = pills.findIndex((pill) => pill.key === active);
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % pills.length;
        else if (event.key === "ArrowLeft") next = (index - 1 + pills.length) % pills.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = pills.length - 1;
        else return;
        event.preventDefault();
        const key = pills[next].key;
        onChange(key);
        refs.current.get(key)?.focus();
    };

    return (
        <div role="tablist" aria-label={ariaLabel} className="agent-pills" onKeyDown={onKeyDown}>
            {pills.map((pill) => {
                const isActive = pill.key === active;
                return (
                    <button
                        key={pill.key}
                        ref={(node) => {
                            if (node) refs.current.set(pill.key, node);
                            else refs.current.delete(pill.key);
                        }}
                        id={tabId(idPrefix, pill.key)}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={panelId(idPrefix, pill.key)}
                        tabIndex={isActive ? 0 : -1}
                        className="agent-pills__pill"
                        onClick={() => onChange(pill.key)}
                    >
                        {pill.dot ? <span className="agent-pills__dot" style={{ background: pill.dot }} aria-hidden="true" /> : null}
                        {pill.label}
                    </button>
                );
            })}
        </div>
    );
}
