import { useEffect, useState } from "react";

interface AiThinkingIndicatorProps {
    size?: number;
    className?: string;
    /** denser “card body” loader with skeleton lines (redesign). */
    variant?: "inline" | "panel";
}

const PHRASES = [
    "Reading lead activity…",
    "Checking recent notes…",
    "Reviewing open tasks…",
    "Weighing risk signals…",
    "Drafting key facts…",
    "Summarizing status…",
    "Finding the next step…",
    "Almost there…",
];

/**
 * Loading state for entity AI summaries.
 * Prefer concrete English phrases (always available) over lang-file indexes that
 * often render as raw keys when translations aren't wired on the page.
 */
export default function AiThinkingIndicator({
    size = 18,
    className,
    variant = "inline",
}: AiThinkingIndicatorProps) {
    const [phraseIndex, setPhraseIndex] = useState(() =>
        Math.floor(Math.random() * PHRASES.length),
    );

    useEffect(() => {
        const interval = window.setInterval(() => {
            setPhraseIndex((current) => (current + 1) % PHRASES.length);
        }, 2000);
        return () => window.clearInterval(interval);
    }, []);

    if (variant === "panel") {
        return (
            <div
                className={`entity-ai-summary-loading-panel${className ? ` ${className}` : ""}`}
                role="status"
                aria-live="polite"
            >
                <div className="entity-ai-summary-loading-panel__row">
                    <span
                        className="entity-ai-summary-loading-panel__spinner"
                        aria-hidden="true"
                    />
                    <span className="entity-ai-summary-loading-panel__label">
                        {PHRASES[phraseIndex]}
                    </span>
                </div>
                <div className="entity-ai-summary-loading-panel__skeleton" aria-hidden="true">
                    <span className="entity-ai-summary-loading-panel__line entity-ai-summary-loading-panel__line--lg" />
                    <span className="entity-ai-summary-loading-panel__line" />
                    <span className="entity-ai-summary-loading-panel__line entity-ai-summary-loading-panel__line--md" />
                    <span className="entity-ai-summary-loading-panel__line entity-ai-summary-loading-panel__line--sm" />
                </div>
            </div>
        );
    }

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
            <span className="entity-ai-summary-loading__text">
                {PHRASES[phraseIndex]}
            </span>
        </span>
    );
}
