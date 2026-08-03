import { useState } from "react";
import { Link } from "@inertiajs/react";
import { Icon } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import LeadMergeReviewModal from "@/Features/Leads/Merge/LeadMergeReviewModal";
import type { LeadDuplicateCandidate } from "@/Types/api/lead-merge";

interface DuplicateLeadsCardProps {
    leadId: number;
    duplicates: LeadDuplicateCandidate[];
    isLoading: boolean;
    onDismiss: () => void;
    onMerged?: () => void;
}

function candidateMeta(candidate: LeadDuplicateCandidate): string {
    return [candidate.client_email, candidate.mobile, candidate.company_name]
        .filter(Boolean)
        .join(" · ");
}

/**
 * Inline duplicate alert — auto-shown when matches exist, or after a manual
 * Find duplicates action (including empty / loading states). Collapsible when
 * listing possible duplicates.
 */
export default function DuplicateLeadsCard({
    leadId,
    duplicates,
    isLoading,
    onDismiss,
    onMerged,
}: DuplicateLeadsCardProps) {
    const { td } = useTd();
    const [expanded, setExpanded] = useState(false);
    const [reviewCandidateId, setReviewCandidateId] = useState<number | null>(
        null,
    );

    const hasDuplicates = !isLoading && duplicates.length > 0;
    const showBody = isLoading || duplicates.length === 0 || expanded;

    return (
        <>
            <section
                className={`v2-duplicate-card${expanded || !hasDuplicates ? "" : " is-collapsed"}`}
                aria-live="polite"
                aria-busy={isLoading}
            >
                <div className="v2-duplicate-card__header">
                    {hasDuplicates ? (
                        <button
                            type="button"
                            className="v2-duplicate-card__toggle"
                            onClick={() => setExpanded((value) => !value)}
                            aria-expanded={expanded}
                        >
                            <span
                                className="v2-duplicate-card__icon"
                                aria-hidden
                            >
                                <Icon name="users" size={14} />
                            </span>
                            <h2 className="v2-duplicate-card__title">
                                {td("Possible duplicate contacts")}
                            </h2>
                            <span className="v2-pill v2-pill-amber">
                                {duplicates.length}
                            </span>
                            <span
                                className="v2-duplicate-card__chevron"
                                aria-hidden
                            >
                                <Icon
                                    name={
                                        expanded ? "chevron-up" : "chevron-down"
                                    }
                                    size={14}
                                />
                            </span>
                        </button>
                    ) : (
                        <div className="v2-duplicate-card__title-row">
                            <span
                                className="v2-duplicate-card__icon"
                                aria-hidden
                            >
                                <Icon name="users" size={14} />
                            </span>
                            <h2 className="v2-duplicate-card__title">
                                {isLoading
                                    ? td("Checking for duplicates…")
                                    : td("No duplicates found")}
                            </h2>
                        </div>
                    )}
                    <button
                        type="button"
                        className="v2-duplicate-card__dismiss"
                        onClick={onDismiss}
                        aria-label={td("Dismiss")}
                        title={td("Dismiss")}
                    >
                        <Icon name="x" size={14} />
                    </button>
                </div>

                {showBody ? (
                    isLoading ? (
                        <div className="v2-duplicate-card__loading">
                            <span className="v2-duplicate-card__spinner" />
                            <span>{td("Looking for matching leads…")}</span>
                        </div>
                    ) : duplicates.length === 0 ? (
                        <p className="v2-duplicate-card__empty">
                            {td(
                                "No other contacts share this lead’s email or phone number.",
                            )}
                        </p>
                    ) : (
                        <ul className="v2-duplicate-card__list">
                            {duplicates.map((candidate) => (
                                <li
                                    key={candidate.id}
                                    className="v2-duplicate-card__item"
                                >
                                    <div className="v2-duplicate-card__item-body">
                                        <Link
                                            href={route(
                                                "lead-contact.show",
                                                candidate.id,
                                            )}
                                            className="v2-duplicate-card__name"
                                        >
                                            {candidate.client_name ||
                                                td("Unnamed lead")}
                                        </Link>
                                        {candidateMeta(candidate) ? (
                                            <div className="v2-duplicate-card__meta">
                                                {candidateMeta(candidate)}
                                            </div>
                                        ) : null}
                                    </div>
                                    <button
                                        type="button"
                                        className="v2-btn v2-btn-ghost"
                                        style={{
                                            padding: "6px 10px",
                                            fontSize: 12,
                                            flexShrink: 0,
                                        }}
                                        onClick={() =>
                                            setReviewCandidateId(candidate.id)
                                        }
                                    >
                                        {td("Review merge")}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )
                ) : null}
            </section>

            {reviewCandidateId !== null ? (
                <LeadMergeReviewModal
                    open
                    primaryId={leadId}
                    duplicateId={reviewCandidateId}
                    onClose={(merged) => {
                        setReviewCandidateId(null);
                        if (merged) onMerged?.();
                    }}
                />
            ) : null}
        </>
    );
}
