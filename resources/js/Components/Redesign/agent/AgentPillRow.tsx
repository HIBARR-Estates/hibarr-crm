import { useEffect, useRef } from "react";

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
}

/**
 * The second row of pills under the dock. Pills are client-side state that a
 * page keeps in its URL (no server round trip). On narrow screens the row
 * scrolls sideways and keeps the active pill in view.
 */
export default function AgentPillRow<K extends string>({ pills, active, onChange, ariaLabel }: AgentPillRowProps<K>) {
    const activeRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, [active]);

    return (
        <div role="tablist" aria-label={ariaLabel} className="agent-pills">
            {pills.map((pill) => {
                const isActive = pill.key === active;
                return (
                    <button
                        key={pill.key}
                        ref={isActive ? activeRef : undefined}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
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
