import type { ReactNode } from "react";

/** A preferences card: a small caps label, an optional action beside it, then its rows. */
export function PrefCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
    return (
        <section className="agent-pr__card">
            <div className="agent-pr__card-head">
                <h2 className="agent-pr__label">{title}</h2>
                {action}
            </div>
            {children}
        </section>
    );
}

/** One setting: its name and what it does on the left, its control on the right. */
export function PrefRow({ title, text, children }: { title: string; text: ReactNode; children: ReactNode }) {
    return (
        <div className="agent-pr__row">
            <span className="agent-pr__row-text">
                <b>{title}</b>
                <small>{text}</small>
            </span>
            <span className="agent-pr__row-control">{children}</span>
        </div>
    );
}

export function CardSkeleton({ rows = 2 }: { rows?: number }) {
    return (
        <section className="agent-pr__card" aria-hidden="true">
            <div className="agent-pr__skeleton agent-pr__skeleton--label" />
            {Array.from({ length: rows }, (_, row) => (
                <div key={row} className="agent-pr__row">
                    <span className="agent-pr__skeleton agent-pr__skeleton--text" />
                    <span className="agent-pr__skeleton agent-pr__skeleton--control" />
                </div>
            ))}
        </section>
    );
}
