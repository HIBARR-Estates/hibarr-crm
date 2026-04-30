import React, { useState, useCallback } from "react";
import { Button, Card, Input, Modal, Skeleton, message } from "antd";
import { RobotOutlined, SaveOutlined } from "@ant-design/icons";
import axios from "axios";
import { marked } from "marked";
import DOMPurify from "dompurify";

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

    const renderMarkdown = useCallback((content: string) => {
        const html = marked.parse(content, {
            breaks: true,
            gfm: true,
        }) as string;

        return {
            __html: DOMPurify.sanitize(html),
        };
    }, []);

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
                    <div
                        className="text-sm text-gray-700 leading-relaxed space-y-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_pre]:overflow-auto [&_pre]:rounded [&_pre]:bg-gray-100 [&_pre]:p-3 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:text-gray-600 [&_a]:text-blue-600 [&_a]:underline"
                        dangerouslySetInnerHTML={renderMarkdown(summary)}
                    />
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
                        <div className="max-h-48 overflow-auto rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700">
                            {summary ? (
                                <div
                                    className="space-y-1 [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-0.5 [&_code]:rounded [&_code]:bg-gray-200 [&_code]:px-1"
                                    dangerouslySetInnerHTML={renderMarkdown(summary)}
                                />
                            ) : (
                                "No summary to save."
                            )}
                        </div>
                    </div>
                </div>
            </Modal>
        </Card>
    );
};

export default AiSummaryPanel;
