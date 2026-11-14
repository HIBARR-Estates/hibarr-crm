import type { ReactNode } from "react";
import { Link } from "@inertiajs/react";
import AgentNewTag from "./AgentNewTag";

export interface AgentLinkPill {
    key: string;
    label: string;
    href: string;
    /** Optional status dot colour. */
    dot?: string | null;
    title?: string;
    current: boolean;
    /** Why the pill is held, when its page is not built yet: it shows disabled with a New tag. */
    heldHint?: string;
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
            {pills.map((pill) =>
                pill.heldHint ? (
                    <span key={pill.key} className="agent-pills__pill agent-pills__pill--held" aria-disabled="true">
                        {pill.label}
                        <AgentNewTag hint={pill.heldHint} />
                    </span>
                ) : (
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
                ),
            )}
            {trailing}
        </nav>
    );
}
