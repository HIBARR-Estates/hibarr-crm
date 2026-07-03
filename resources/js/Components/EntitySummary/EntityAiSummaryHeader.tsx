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
}

export default function EntityAiSummaryHeader({
    title,
    generatedAt,
    loading,
    onRegenerate,
    dataConfidence,
}: EntityAiSummaryHeaderProps) {
    const timestampLabel = generatedAt
        ? `refreshed ${dayjs(generatedAt).fromNow()}`
        : null;

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
                    <span className="entity-ai-summary-confidence">Low confidence</span>
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
