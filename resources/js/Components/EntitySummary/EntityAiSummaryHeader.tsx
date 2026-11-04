import { ReloadOutlined, RobotOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { ChevronDown, RotateCw, Sparkles } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { usePersonalize } from "./SummaryPersonalization";
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
    /** Redesign lead brief layout: the generated time is part of the label, and the
     * confidence badge, Regenerate and the accordion arrow sit together on the right
     * (arrow furthest right). The risk badge is not shown in this layout. */
    leadBrief?: boolean;
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
    leadBrief = false,
}: EntityAiSummaryHeaderProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const personalize = usePersonalize();

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
        const redesignTimestampLabel = generatedAt
            ? t("pages.entity_summary.generated_at", {
                  time: dayjs(generatedAt).fromNow(),
              })
            : null;
        const redesignRiskLabel = riskLevel
            ? t("pages.entity_summary.risk_label", {
                  level: t(`pages.entity_summary.risk.${riskLevel}`),
              })
            : null;
        const emptyPromptKey =
            entityType === "deal"
                ? "pages.entity_summary.empty_prompt_deal"
                : "pages.entity_summary.empty_prompt_lead";

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
                                {t("pages.entity_summary.generating_summary")}
                            </span>
                        ) : (
                            <span className="entity-ai-summary-header__status-line entity-ai-summary-header__status-line--muted">
                                {t(emptyPromptKey)}
                            </span>
                        )}
                    </span>
                    <button
                        type="button"
                        className="entity-ai-summary-header__quick-generate"
                        disabled={loading}
                        onClick={onRegenerate}
                    >
                        {loading
                            ? t("pages.entity_summary.generating")
                            : t("pages.entity_summary.generate_summary")}
                    </button>
                </div>
            );
        }

        const expanded = !collapsed;

        if (leadBrief) {
            const generatedAgo = generatedAt ? dayjs(generatedAt).fromNow() : null;

            return (
                <div className="entity-ai-summary-lead-header">
                    {/* Clicking the label area also toggles, as the whole header used to.
                        It is a pointer convenience only: the arrow button on the right is
                        the keyboard- and screen-reader-accessible control. */}
                    <div
                        className="entity-ai-summary-lead-header__main"
                        role="presentation"
                        onClick={onToggleCollapse}
                    >
                        <span className="entity-ai-summary-lead-header__label">
                            <Sparkles
                                width={14}
                                height={14}
                                strokeWidth={2}
                                aria-hidden="true"
                                className="entity-ai-summary-lead-header__spark"
                            />
                            <span>
                                {generatedAgo
                                    ? `${title} · ${generatedAgo}`
                                    : title}
                            </span>
                            {isStale && (
                                <span className="entity-ai-summary-stale-pill">
                                    {t("pages.entity_summary.out_of_date")}
                                </span>
                            )}
                            {isHeuristic && (
                                <span className="entity-ai-summary-heuristic-pill">
                                    {t("pages.entity_summary.fallback")}
                                </span>
                            )}
                        </span>
                        {statusLine && (
                            <span className="entity-ai-summary-header__status-line">
                                {personalize(td(statusLine, { source: "en" }))}
                            </span>
                        )}
                    </div>

                    <div className="entity-ai-summary-lead-header__actions">
                        {shownConfidence && (
                            <span
                                className={`entity-ai-summary-confidence-pill entity-ai-summary-confidence-pill--${shownConfidence}`}
                            >
                                {t("pages.entity_summary.confidence_badge", {
                                    level: t(
                                        `pages.entity_summary.confidence.${shownConfidence}`,
                                    ),
                                })}
                            </span>
                        )}
                        <button
                            type="button"
                            className="entity-ai-summary-regenerate-btn"
                            disabled={loading}
                            onClick={onRegenerate}
                        >
                            <RotateCw
                                width={14}
                                height={14}
                                strokeWidth={2}
                                aria-hidden="true"
                            />
                            {isStale
                                ? t("pages.entity_summary.refresh")
                                : t("pages.entity_summary.regenerate")}
                        </button>
                        <button
                            type="button"
                            className="entity-ai-summary-lead-header__chevron"
                            aria-expanded={expanded}
                            aria-label={t(
                                expanded
                                    ? "pages.entity_summary.collapse_summary"
                                    : "pages.entity_summary.expand_summary",
                            )}
                            onClick={onToggleCollapse}
                        >
                            <ChevronDown
                                width={18}
                                height={18}
                                strokeWidth={2}
                                aria-hidden="true"
                            />
                        </button>
                    </div>
                </div>
            );
        }

        const toggle = (
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
                        {riskLevel && redesignRiskLabel && (
                            <span
                                className={`entity-ai-summary-risk-pill ${RISK_BADGE[riskLevel]}`}
                            >
                                {redesignRiskLabel}
                            </span>
                        )}
                        {isStale && (
                            <span className="entity-ai-summary-stale-pill">
                                {t("pages.entity_summary.out_of_date")}
                            </span>
                        )}
                        {isHeuristic && (
                            <span className="entity-ai-summary-heuristic-pill">
                                {t("pages.entity_summary.fallback")}
                            </span>
                        )}
                        {(redesignTimestampLabel || shownConfidence) && (
                            <span className="entity-ai-summary-header__timestamp entity-ai-summary-header__timestamp--redesign">
                                {redesignTimestampLabel}
                                {redesignTimestampLabel && shownConfidence
                                    ? " · "
                                    : ""}
                                {shownConfidence
                                    ? t("pages.entity_summary.confidence_label", {
                                          level: t(
                                              `pages.entity_summary.confidence.${shownConfidence}`,
                                          ),
                                      })
                                    : ""}
                            </span>
                        )}
                    </span>
                    {statusLine && (
                        <span className="entity-ai-summary-header__status-line">
                            {personalize(td(statusLine, { source: "en" }))}
                        </span>
                    )}
                    {collapsed && chips.length > 0 && (
                        <span className="entity-ai-summary-header__chip-preview">
                            {chips.map((chip) => (
                                <span
                                    key={chip.id}
                                    className={`entity-ai-summary-mini-pill ${CHIP_TONE_CLASS[chip.tone] ?? ""}`}
                                >
                                    {td(chip.label, { source: "en" })}:{" "}
                                    {td(chip.value, { source: "en" })}
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

        return toggle;
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
