import { ReloadOutlined, RobotOutlined } from "@ant-design/icons";
import { Button } from "antd";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface EntityAiSummaryHeaderProps {
    title: string;
    generatedAt?: string | null;
    loading: boolean;
    onRegenerate: () => void;
    dataConfidence?: "high" | "medium" | "low";
    variant?: "legacy" | "redesign";
    collapsed?: boolean;
    onToggleCollapse?: () => void;
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
}: EntityAiSummaryHeaderProps) {
    const timestampLabel = generatedAt
        ? `refreshed ${dayjs(generatedAt).fromNow()}`
        : null;

    if (variant === "redesign") {
        return (
            <header className="entity-ai-summary-header entity-ai-summary-header--redesign">
                <span className="entity-ai-summary-header__title-text">
                    {title}
                </span>
                <div className="entity-ai-summary-header__actions">
                    {timestampLabel && (
                        <span className="entity-ai-summary-header__timestamp entity-ai-summary-header__timestamp--redesign">
                            {timestampLabel}
                        </span>
                    )}
                    {dataConfidence === "low" && (
                        <span className="entity-ai-summary-confidence entity-ai-summary-confidence--redesign">
                            Low confidence
                        </span>
                    )}
                    <button
                        type="button"
                        className="entity-ai-summary-header__ghost-btn"
                        onClick={onRegenerate}
                        disabled={loading}
                    >
                        <ReloadOutlined spin={loading} />
                        <span>{loading ? "Working…" : "Regenerate"}</span>
                    </button>
                    {onToggleCollapse && (
                        <button
                            type="button"
                            className="entity-ai-summary-header__ghost-btn"
                            onClick={onToggleCollapse}
                        >
                            {collapsed ? "Expand" : "Collapse"}
                        </button>
                    )}
                </div>
            </header>
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
