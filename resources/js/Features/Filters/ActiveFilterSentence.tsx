import React from "react";
import { useFilter } from "@/contexts/FilterContext";
import { describeFilters } from "./filterSummary";
import "./active-filter-sentence.css";
import { useTranslation } from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface ActiveFilterSentenceProps {
    /** Result count for the currently applied filters. */
    count?: number;
    /** Plural noun for the copy, e.g. "leads" / "deals". */
    entityLabel?: string;
    onOpenFilters: () => void;
    onSaveAsView?: () => void;
}

/**
 * Mockup 3c — the quiet filter bar above the list table. One readable
 * sentence, each clause clickable straight into the filter modal.
 */
export default function ActiveFilterSentence({
    count,
    entityLabel = "leads",
    onOpenFilters,
    onSaveAsView,
}: ActiveFilterSentenceProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { config, filters, clearAllFilters } = useFilter();
    const parts = describeFilters(config, filters, { t, td });
    const entity = td(entityLabel, { source: "en" });

    if (parts.length === 0) return null;

    return (
        <div className="lfs">
            <span className="lfs__dot" />
            <span className="lfs__text">
                {t("pages.filters.showing_where", { entity })}{" "}
                {parts.map((part, index) => (
                    <React.Fragment key={part.keys.join("|")}>
                        {index > 0 &&
                            (index === parts.length - 1
                                ? t("pages.filters.and_join")
                                : ", ")}
                        <button
                            type="button"
                            className="lfs__clause"
                            onClick={onOpenFilters}
                            title={t("pages.filters.edit_filter")}
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
                        <b>{count.toLocaleString()}</b> {entity}
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
                        {t("pages.filters.save_as_view")}
                    </button>
                    <span className="lfs__divider" />
                </>
            )}
            <button
                type="button"
                className="lfs__action lfs__action--danger"
                onClick={clearAllFilters}
            >
                {t("pages.filters.clear_all")}
            </button>
        </div>
    );
}
