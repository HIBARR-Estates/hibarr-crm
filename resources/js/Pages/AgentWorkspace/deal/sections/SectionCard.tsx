import type { ReactNode } from "react";

interface SectionCardProps {
    /** Anchor the section pills scroll to. */
    id: string;
    title: ReactNode;
    /** The card's one action (+ Note, + Upload, ...). */
    action?: ReactNode;
    className?: string;
    children: ReactNode;
}

/**
 * One section of the deal's long page (canvas L7-11): a white card with a
 * title row and its action, then its rows. The pills under the dock scroll
 * to these by id.
 */
export default function SectionCard({ id, title, action, className, children }: SectionCardProps) {
    return (
        <section id={id} className={`agent-deal__section${className ? ` ${className}` : ""}`} aria-labelledby={`${id}-title`}>
            <div className="agent-deal__section-head">
                <h2 id={`${id}-title`} className="agent-deal__section-title">
                    {title}
                </h2>
                {action}
            </div>
            {children}
        </section>
    );
}

/** A quiet line for a section with nothing in it yet. */
export function SectionEmpty({ children }: { children: ReactNode }) {
    return <p className="agent-deal__section-empty">{children}</p>;
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
