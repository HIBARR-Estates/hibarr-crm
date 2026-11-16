import type { ReactNode } from "react";

interface EarningsHeaderProps {
    title: string;
    subtitle: string;
    /** What sits at the right of the title on the band: chips, tabs, a button. */
    children?: ReactNode;
}

/** The title on the navy band, with the screen's controls at its right. */
export default function EarningsHeader({ title, subtitle, children }: EarningsHeaderProps) {
    return (
        <div className="agent-ea__top">
            <div className="agent-ea__heading">
                <h1>{title}</h1>
                <p aria-live="polite">{subtitle}</p>
            </div>
            {children ? <div className="agent-ea__controls">{children}</div> : null}
        </div>
    );
}
