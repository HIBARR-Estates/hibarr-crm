import React, { useState, useCallback } from "react";
import { Button, Card, Input, Modal, Skeleton, message } from "antd";
import { RobotOutlined, SaveOutlined } from "@ant-design/icons";
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
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveTitle, setSaveTitle] = useState("");
    const [saveDescription, setSaveDescription] = useState("");

    const defaultTitle = `AI Summary: ${contextLabel} (${filters.start_date} to ${filters.end_date})`;

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
            if (!saveTitle) {
                setSaveTitle(defaultTitle);
            }
        } catch (err: any) {
            if (err.code === "ECONNABORTED") {
                setError("The AI summary request timed out. Please try again.");
            } else {
                setError("Failed to generate AI summary. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    }, [filters, defaultTitle, saveTitle]);

    const openSaveModal = useCallback(() => {
        setSaveTitle((prev) => prev || defaultTitle);
        setIsSaveModalOpen(true);
    }, [defaultTitle]);

    const handleSaveSummary = useCallback(async () => {
        if (!summary) {
            return;
        }

        setSaving(true);

        try {
            await axios.post(
                "/account/agent-reports/saved-summaries",
                {
                    title: saveTitle?.trim() || null,
                    description: saveDescription?.trim() || null,
                    summary,
                    start_date: filters.start_date,
                    end_date: filters.end_date,
                    agent_id: filters.agent_id,
                    view_type: filters.view_type,
                    context_label: contextLabel,
                },
                { timeout: 15000 },
            );

            message.success("Summary saved successfully.");
            setIsSaveModalOpen(false);
            setSaveDescription("");
        } catch {
            message.error("Failed to save summary. Please try again.");
        } finally {
            setSaving(false);
        }
    }, [
        summary,
        saveTitle,
        saveDescription,
        filters.start_date,
        filters.end_date,
        filters.agent_id,
        filters.view_type,
        contextLabel,
    ]);

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
                <div className="flex items-center gap-2">
                    {summary && (
                        <Button icon={<SaveOutlined />} onClick={openSaveModal}>
                            Save as Note
                        </Button>
                    )}
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
                </div>
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

            <Modal
                title="Save AI Summary as Note"
                open={isSaveModalOpen}
                onCancel={() => setIsSaveModalOpen(false)}
                onOk={handleSaveSummary}
                okText="Save"
                okButtonProps={{ loading: saving }}
            >
                <div className="space-y-3">
                    <div>
                        <div className="text-xs text-gray-500 mb-1">Title (optional)</div>
                        <Input
                            value={saveTitle}
                            onChange={(e) => setSaveTitle(e.target.value)}
                            placeholder="Summary title"
                            maxLength={255}
                        />
                    </div>

                    <div>
                        <div className="text-xs text-gray-500 mb-1">Description (optional)</div>
                        <Input.TextArea
                            value={saveDescription}
                            onChange={(e) => setSaveDescription(e.target.value)}
                            placeholder="Short context for this note"
                            autoSize={{ minRows: 3, maxRows: 6 }}
                            maxLength={2000}
                        />
                    </div>

                    <div>
                        <div className="text-xs text-gray-500 mb-1">Summary preview</div>
                        <div className="max-h-48 overflow-auto rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700 whitespace-pre-wrap">
                            {summary || "No summary to save."}
                        </div>
                    </div>
                </div>
            </Modal>
        </Card>
    );
};

export default AiSummaryPanel;
