import type { ReactNode } from "react";
import { Link } from "@inertiajs/react";

export interface AgentLinkPill {
    key: string;
    label: string;
    href: string;
    /** Optional status dot colour. */
    dot?: string | null;
    title?: string;
    current: boolean;
}

interface AgentLinkPillsProps {
    pills: AgentLinkPill[];
    ariaLabel: string;
    /** Rendered after the pills, e.g. an action pill. */
    trailing?: ReactNode;
}

/**
 * The second row's pills when each one is its own page (a person's deals),
 * so they are links, not tabs: they prefetch on hover and press like the
 * dock, and the current one carries aria-current. Same look as AgentPillRow.
 */
export default function AgentLinkPills({ pills, ariaLabel, trailing }: AgentLinkPillsProps) {
    return (
        <nav aria-label={ariaLabel} className="agent-pills">
            {pills.map((pill) => (
                <Link
                    key={pill.key}
                    href={pill.href}
                    prefetch={["hover", "click"]}
                    cacheFor="30s"
                    preserveScroll={false}
                    aria-current={pill.current ? "page" : undefined}
                    className="agent-pills__pill"
                    title={pill.title}
                >
                    {pill.dot ? <span className="agent-pills__dot" style={{ background: pill.dot }} aria-hidden="true" /> : null}
                    {pill.label}
                </Link>
            ))}
            {trailing}
        </nav>
    );
}
