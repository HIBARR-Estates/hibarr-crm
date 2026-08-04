import { ReloadOutlined, RobotOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { Sparkles } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import type {
    EntitySummaryChip,
    EntitySummaryEntityType,
    EntitySummaryRiskLevel,
} from "@/Types/entity-summary";

dayjs.extend(relativeTime);

const RISK_BADGE: Record<EntitySummaryRiskLevel, string> = {
    none: "entity-ai-summary-risk-pill--green",
    low: "entity-ai-summary-risk-pill--green",
    medium: "entity-ai-summary-risk-pill--amber",
    high: "entity-ai-summary-risk-pill--red",
};

const CHIP_TONE_CLASS: Record<string, string> = {
    green: "entity-ai-summary-mini-pill--green",
    amber: "entity-ai-summary-mini-pill--amber",
    red: "entity-ai-summary-mini-pill--red",
    neutral: "entity-ai-summary-mini-pill--gray",
};

interface EntityAiSummaryHeaderProps {
    title: string;
    entityType: EntitySummaryEntityType;
    generatedAt?: string | null;
    loading: boolean;
    onRegenerate: () => void;
    dataConfidence?: "high" | "medium" | "low";
    variant?: "legacy" | "redesign";
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    statusLine?: string;
    riskLevel?: EntitySummaryRiskLevel;
    chips?: EntitySummaryChip[];
    /** No summary exists yet — the banner isn't collapse/expand-toggleable
     * (there's nothing to expand into) and instead shows what to do next. */
    hasSummary?: boolean;
    isStale?: boolean;
    isHeuristic?: boolean;
}

export default function EntityAiSummaryHeader({
    title,
    entityType,
    generatedAt,
    loading,
    onRegenerate,
    dataConfidence,
    variant = "legacy",
    collapsed = false,
    onToggleCollapse,
    statusLine,
    riskLevel,
    chips = [],
    hasSummary = false,
    isStale = false,
    isHeuristic = false,
}: EntityAiSummaryHeaderProps) {
    const timestampLabel = generatedAt
        ? `generated ${dayjs(generatedAt).fromNow()}`
        : null;
    // Confidence is about the input at generation time. When the deal has
    // changed since then, showing "confidence: high" next to "Out of date"
    // is contradictory — hide it until the summary is refreshed.
    const shownConfidence = isStale ? undefined : dataConfidence;
    const riskLabel = riskLevel ? `Risk: ${riskLevel}` : null;

    if (variant === "redesign") {
        const sparkIcon = <Sparkles width={15} height={15} strokeWidth={2} />;

        if (!hasSummary) {
            // Not toggleable — there's no detail to expand into until a
            // summary exists, so this is a plain banner, not a button.
            return (
                <div className="entity-ai-summary-header entity-ai-summary-header--redesign entity-ai-summary-header--empty">
                    <span
                        className="entity-ai-summary-header__spark"
                        aria-hidden="true"
                    >
                        {sparkIcon}
                    </span>
                    <span className="entity-ai-summary-header__redesign-body">
                        <span className="entity-ai-summary-header__redesign-meta">
                            <span className="entity-ai-summary-header__title-text">
                                {title}
                            </span>
                        </span>
                        {loading ? (
                            <span className="entity-ai-summary-header__status-line">
                                Generating summary…
                            </span>
                        ) : (
                            <span className="entity-ai-summary-header__status-line entity-ai-summary-header__status-line--muted">
                                {`Generate an AI summary to see key facts, risk signals, and a suggested next step for this ${entityType}.`}
                            </span>
                        )}
                    </span>
                    <button
                        type="button"
                        className="entity-ai-summary-header__quick-generate"
                        disabled={loading}
                        onClick={onRegenerate}
                    >
                        {loading ? "Generating…" : "Generate summary"}
                    </button>
                </div>
            );
        }

        const expanded = !collapsed;
        return (
            <div
                role="button"
                tabIndex={0}
                className="entity-ai-summary-header entity-ai-summary-header--redesign"
                aria-expanded={expanded}
                onClick={onToggleCollapse}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onToggleCollapse?.();
                    }
                }}
            >
                <span className="entity-ai-summary-header__spark" aria-hidden="true">
                    {sparkIcon}
                </span>
                <span className="entity-ai-summary-header__redesign-body">
                    <span className="entity-ai-summary-header__redesign-meta">
                        <span className="entity-ai-summary-header__title-text">
                            {title}
                        </span>
                        {riskLevel && riskLabel && (
                            <span
                                className={`entity-ai-summary-risk-pill ${RISK_BADGE[riskLevel]}`}
                            >
                                {riskLabel}
                            </span>
                        )}
                        {isStale && (
                            <span className="entity-ai-summary-stale-pill">
                                Out of date
                            </span>
                        )}
                        {isHeuristic && (
                            <span className="entity-ai-summary-heuristic-pill">
                                Fallback
                            </span>
                        )}
                        {(timestampLabel || shownConfidence) && (
                            <span className="entity-ai-summary-header__timestamp entity-ai-summary-header__timestamp--redesign">
                                {timestampLabel}
                                {timestampLabel && shownConfidence ? " · " : ""}
                                {shownConfidence ? `confidence ${shownConfidence}` : ""}
                            </span>
                        )}
                    </span>
                    {statusLine && (
                        <span className="entity-ai-summary-header__status-line">
                            {statusLine}
                        </span>
                    )}
                    {collapsed && chips.length > 0 && (
                        <span className="entity-ai-summary-header__chip-preview">
                            {chips.map((chip) => (
                                <span
                                    key={chip.id}
                                    className={`entity-ai-summary-mini-pill ${CHIP_TONE_CLASS[chip.tone] ?? ""}`}
                                >
                                    {chip.label}: {chip.value}
                                </span>
                            ))}
                        </span>
                    )}
                </span>
                <span className="entity-ai-summary-header__chevron" aria-hidden="true">
                    {expanded ? "▴" : "▾"}
                </span>
            </div>
        );
    }

    return (
        <header className="entity-ai-summary-header">
            <div className="entity-ai-summary-header__title">
                <span className="entity-ai-summary-header__icon">
                    <RobotOutlined />
                </span>
                <span>{title}</span>
                {timestampLabel && (
                    <span className="entity-ai-summary-header__timestamp">
                        {timestampLabel}
                    </span>
                )}
                {isStale && (
                    <span className="entity-ai-summary-stale-pill">
                        Out of date
                    </span>
                )}
                {isHeuristic && (
                    <span className="entity-ai-summary-heuristic-pill">
                        Fallback
                    </span>
                )}
                {shownConfidence === "low" && (
                    <span className="entity-ai-summary-confidence">
                        Low confidence
                    </span>
                )}
            </div>
            <Button
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={onRegenerate}
                size="small"
            >
                {isStale ? "Refresh" : "Regenerate"}
            </Button>
        </header>
    );
}
