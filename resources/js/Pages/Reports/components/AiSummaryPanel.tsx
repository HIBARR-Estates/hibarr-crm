import React, { useState, useCallback } from "react";
import { Button, Card, Skeleton } from "antd";
import { RobotOutlined } from "@ant-design/icons";
import axios from "axios";

interface Filters {
    start_date: string;
    end_date: string;
    agent_id: number | null;
    view_type: "agent" | "department";
}

interface AiSummaryPanelProps {
    filters: Filters;
    contextLabel: string;
}

const AiSummaryPanel: React.FC<AiSummaryPanelProps> = ({
    filters,
    contextLabel,
}) => {
    const [summary, setSummary] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const payload: Record<string, any> = {
                start_date: filters.start_date,
                end_date: filters.end_date,
                view_type: filters.view_type,
            };
            if (filters.agent_id) {
                payload.agent_id = filters.agent_id;
            }

            const res = await axios.post<{ summary: string }>(
                "/account/agent-reports/ai-summary",
                payload,
                { timeout: 30000 },
            );
            setSummary(res.data.summary);
        } catch (err: any) {
            if (err.code === "ECONNABORTED") {
                setError("The AI summary request timed out. Please try again.");
            } else {
                setError("Failed to generate AI summary. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    }, [filters]);

    return (
        <Card
            title={
                <span className="flex items-center gap-2">
                    <RobotOutlined className="text-purple-500" />
                    AI Insight Engine
                </span>
            }
            className="border border-gray-200"
            extra={
                <Button
                    type="primary"
                    icon={<RobotOutlined />}
                    loading={loading}
                    onClick={handleGenerate}
                    disabled={
                        loading || !filters.start_date || !filters.end_date
                    }
                >
                    {summary ? "Regenerate" : "Generate AI Summary"}
                </Button>
            }
        >
            {loading && <Skeleton active paragraph={{ rows: 4 }} />}

            {error && !loading && (
                <div className="text-red-500 text-sm">{error}</div>
            )}

            {summary && !loading && (
                <div className="space-y-2">
                    <div className="text-xs text-gray-400">
                        Summary for {contextLabel} &middot; {filters.start_date}{" "}
                        to {filters.end_date}
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                        {summary}
                    </div>
                </div>
            )}

            {!summary && !loading && !error && (
                <div className="text-sm text-gray-400">
                    Click &quot;Generate AI Summary&quot; to analyze notes for{" "}
                    {contextLabel} in the selected period. This will not run
                    automatically to save API costs.
                </div>
            )}
        </Card>
    );
};

export default AiSummaryPanel;
