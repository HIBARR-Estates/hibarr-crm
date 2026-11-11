import { useId, useState, type ReactNode } from "react";

export interface FlowSideTab {
    key: string;
    label: string;
    /** Shown after the label ("Answers · 14"). */
    count?: number;
    content: ReactNode;
}

interface FlowSideTabsProps {
    tabs: FlowSideTab[];
    /** Pinned under the panel (the analysis's Complete button). */
    footer?: ReactNode;
}

/**
 * The right column of a flow under the dock (canvas L7-07, L7-12): two
 * button tabs, the person's facts and the answers so far, each with the
 * column's full height.
 */
export default function FlowSideTabs({ tabs, footer }: FlowSideTabsProps) {
    const [active, setActive] = useState(tabs[0]?.key);
    const id = useId();
    const current = tabs.find((tab) => tab.key === active) ?? tabs[0];

    return (
        <div className="agent-flow__side">
            <div className="agent-flow__side-tabs" role="tablist">
                {tabs.map((tab) => {
                    const selected = tab.key === current?.key;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            id={`${id}-tab-${tab.key}`}
                            aria-selected={selected}
                            aria-controls={`${id}-panel`}
                            className={`agent-flow__side-tab${selected ? " agent-flow__side-tab--active" : ""}`}
                            onClick={() => setActive(tab.key)}
                        >
                            {tab.count ? `${tab.label} · ${tab.count}` : tab.label}
                        </button>
                    );
                })}
            </div>
            <div
                className="agent-flow__side-panel"
                role="tabpanel"
                id={`${id}-panel`}
                aria-labelledby={current ? `${id}-tab-${current.key}` : undefined}
            >
                {current?.content}
            </div>
            {footer ? <div className="agent-flow__side-foot">{footer}</div> : null}
        </div>
    );
}
