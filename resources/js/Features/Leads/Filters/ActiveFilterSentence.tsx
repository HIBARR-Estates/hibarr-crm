import React from "react";
import { useFilter } from "@/contexts/FilterContext";
import { describeFilters } from "./filterSummary";
import "./active-filter-sentence.css";

interface ActiveFilterSentenceProps {
    /** Result count for the currently applied filters. */
    count?: number;
    onOpenFilters: () => void;
    onSaveAsView?: () => void;
}

/**
 * Mockup 3c — the quiet filter bar above the leads table. One readable
 * sentence, each clause clickable straight into the filter modal.
 */
export default function ActiveFilterSentence({
    count,
    onOpenFilters,
    onSaveAsView,
}: ActiveFilterSentenceProps) {
    const { config, filters, clearAllFilters } = useFilter();
    const parts = describeFilters(config, filters);

    if (parts.length === 0) return null;

    return (
        <div className="lfs">
            <span className="lfs__dot" />
            <span className="lfs__text">
                Showing leads where{" "}
                {parts.map((part, index) => (
                    <React.Fragment key={part.keys.join("|")}>
                        {index > 0 &&
                            (index === parts.length - 1 ? " and " : ", ")}
                        <button
                            type="button"
                            className="lfs__clause"
                            onClick={onOpenFilters}
                            title="Edit this filter"
                        >
                            {part.text}
                        </button>
                    </React.Fragment>
                ))}
            </span>

            {count != null && (
                <>
                    <span className="lfs__sep">—</span>
                    <span className="lfs__count">
                        <b>{count.toLocaleString()}</b> leads
                    </span>
                </>
            )}

            <div className="lfs__spacer" />

            {onSaveAsView && (
                <>
                    <button
                        type="button"
                        className="lfs__action"
                        onClick={onSaveAsView}
                    >
                        Save as view
                    </button>
                    <span className="lfs__divider" />
                </>
            )}
            <button
                type="button"
                className="lfs__action lfs__action--danger"
                onClick={clearAllFilters}
            >
                Clear all
            </button>
        </div>
    );
}
