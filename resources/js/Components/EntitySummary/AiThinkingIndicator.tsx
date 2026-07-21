import { useEffect, useState } from "react";

const PHRASES = [
    "Reading recent activity",
    "Checking notes and meetings",
    "Reviewing open tasks",
    "Tracing the stage history",
    "Looking over attached documents",
    "Weighing risk signals",
    "Checking what's overdue",
    "Piecing the timeline together",
    "Working out the next step",
    "Drafting the summary",
    "Tidying up the wording",
];

interface AiThinkingIndicatorProps {
    size?: number;
    className?: string;
}

/** Rotating-phrase + shimmer-text "AI is working" indicator — used wherever
 * an entity summary is being generated or regenerated, instead of a generic
 * content skeleton (which reads as "slow query", not "a model is thinking"). */
export default function AiThinkingIndicator({
    size = 18,
    className,
}: AiThinkingIndicatorProps) {
    // Random start so short generations don't always show the same first two
    // phrases — otherwise most of the list is never seen.
    const [phraseIndex, setPhraseIndex] = useState(() =>
        Math.floor(Math.random() * PHRASES.length),
    );

    useEffect(() => {
        const interval = window.setInterval(() => {
            setPhraseIndex((current) => (current + 1) % PHRASES.length);
        }, 1800);
        return () => window.clearInterval(interval);
    }, []);

    return (
        <span
            className={`entity-ai-summary-loading${className ? ` ${className}` : ""}`}
            role="status"
            aria-live="polite"
        >
            <span className="entity-ai-summary-loading__icon" aria-hidden="true">
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M12 3l1.9 4.8L19 9.5l-4.2 2.9L15 18l-3-3-3 3 .2-5.6L5 9.5l5.1-1.7z" />
                </svg>
            </span>
            <span className="entity-ai-summary-loading__text entity-ai-summary-loading__text--shimmer">
                {PHRASES[phraseIndex]}
                <span className="entity-ai-summary-loading__dot" aria-hidden="true">
                    .
                </span>
                <span className="entity-ai-summary-loading__dot" aria-hidden="true">
                    .
                </span>
                <span className="entity-ai-summary-loading__dot" aria-hidden="true">
                    .
                </span>
            </span>
        </span>
    );
}
