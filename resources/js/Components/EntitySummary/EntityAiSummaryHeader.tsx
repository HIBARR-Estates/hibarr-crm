import { ReloadOutlined, RobotOutlined } from "@ant-design/icons";
import { Button } from "antd";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import type { EntitySummaryChip, EntitySummaryRiskLevel } from "@/Types/entity-summary";

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
}

export default function EntityAiSummaryHeader({
    title,
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
}: EntityAiSummaryHeaderProps) {
    const timestampLabel = generatedAt
        ? `generated ${dayjs(generatedAt).fromNow()}`
        : null;

    if (variant === "redesign") {
        const expanded = !collapsed;
        return (
            <button
                type="button"
                className="entity-ai-summary-header entity-ai-summary-header--redesign"
                aria-expanded={expanded}
                onClick={onToggleCollapse}
            >
                <span className="entity-ai-summary-header__spark" aria-hidden="true">
                    <RobotOutlined />
                </span>
                <span className="entity-ai-summary-header__redesign-body">
                    <span className="entity-ai-summary-header__redesign-meta">
                        <span className="entity-ai-summary-header__title-text">
                            {title}
                        </span>
                        {riskLevel && (
                            <span
                                className={`entity-ai-summary-risk-pill ${RISK_BADGE[riskLevel]}`}
                            >
                                Risk: {riskLevel}
                            </span>
                        )}
                        {(timestampLabel || dataConfidence) && (
                            <span className="entity-ai-summary-header__timestamp entity-ai-summary-header__timestamp--redesign">
                                {timestampLabel}
                                {timestampLabel && dataConfidence ? " · " : ""}
                                {dataConfidence ? `confidence ${dataConfidence}` : ""}
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
            </button>
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
                {dataConfidence === "low" && (
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
                Regenerate
            </Button>
        </header>
    );
}
