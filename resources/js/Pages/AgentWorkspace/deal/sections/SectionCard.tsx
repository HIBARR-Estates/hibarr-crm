import type { ReactNode } from "react";
import useTranslation from "@/Hooks/useTranslation";

interface SectionCardProps {
    /** Anchor the section pills scroll to. */
    id: string;
    title: ReactNode;
    /** The card's one action (+ Note, + Upload, ...). */
    action?: ReactNode;
    /** Search and filters under the title (AgentCardControls). */
    controls?: ReactNode;
    className?: string;
    children: ReactNode;
}

/**
 * One card below the fold (canvas L8-04/L8-05): a title row with its action,
 * then its search and filters, then its rows. Every card in a row has the
 * same height and its rows scroll inside, so a long list never stretches the
 * row. The pills under the dock scroll to these by id.
 */
export default function SectionCard({ id, title, action, controls, className, children }: SectionCardProps) {
    return (
        <section id={id} className={`agent-deal__section${className ? ` ${className}` : ""}`} aria-labelledby={`${id}-title`}>
            <div className="agent-deal__section-head">
                <h2 id={`${id}-title`} className="agent-deal__section-title">
                    {title}
                </h2>
                {action}
            </div>
            {controls}
            <div className="agent-deal__section-body">{children}</div>
        </section>
    );
}

/** A quiet line for a section with nothing in it yet. */
export function SectionEmpty({ children }: { children: ReactNode }) {
    return <p className="agent-deal__section-empty">{children}</p>;
}

/** A search or filter that leaves nothing to show. */
export function SectionNoMatch() {
    const { t } = useTranslation();
    return <p className="agent-deal__section-empty">{t("pages.agent_workspace.contact.cards.no_match")}</p>;
}

/** Two grey bars while a section's data loads in the background. */
export function SectionSkeleton() {
    return (
        <div className="agent-card__skeleton" aria-hidden="true">
            <span />
            <span />
        </div>
    );
}
