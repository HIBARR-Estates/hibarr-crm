import React, { useEffect, useState } from "react";
import { Button, Collapse, Descriptions, Spin, Tag } from "antd";
import { PlusOutlined, CheckCircleOutlined } from "@ant-design/icons";
import {
    formatCompanyDate,
    formatCompanyDateTime,
} from "@/lib/companyDateTime";
import { LeadQualification, TemplateTree } from "@/Types/qualification";
import { QualificationTemplateService } from "@/Services/QualificationTemplateService";
import { formatAnswerDisplay } from "./qualificationUtils";

interface CompletedRecapProps {
    qualification: LeadQualification;
    history: LeadQualification[];
    templateService: QualificationTemplateService;
    onStartNew: () => void;
}

const OUTCOME_LABELS: Record<string, string> = {
    bookMeeting: "Consultation booked",
    inviteWebinar: "Webinar invited",
    callback: "Callback requested",
    noFit: "Not a fit",
};

const CompletedRecap: React.FC<CompletedRecapProps> = ({
    qualification,
    history,
    templateService,
    onStartNew,
}) => {
    const [tree, setTree] = useState<TemplateTree | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const response = await templateService.getTemplateTree(
                    qualification.template_id,
                    qualification.template_name,
                );
                setTree(response.data);
            } catch {
                setTree(null);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [
        qualification.template_id,
        qualification.template_name,
        templateService,
    ]);

    const historyItems = history
        .filter((h) => h.id !== qualification.id)
        .map((item) => ({
            key: String(item.id),
            label: (
                <span className="flex items-center gap-2">
                    {item.template_name ?? item.template_id}
                    <Tag>{item.outcome ?? item.status}</Tag>
                    <span className="text-gray-400 text-xs">
                        {item.completed_at
                            ? formatCompanyDate(item.completed_at)
                            : formatCompanyDate(item.created_at)}
                    </span>
                </span>
            ),
            children: (
                <Descriptions size="small" column={1} bordered>
                    <Descriptions.Item label="Agent">
                        {item.agent?.name ?? "—"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Outcome">
                        {item.outcome
                            ? (OUTCOME_LABELS[item.outcome] ?? item.outcome)
                            : "—"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Answers">
                        {(item.answers ?? []).length} captured
                    </Descriptions.Item>
                </Descriptions>
            ),
        }));

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircleOutlined className="text-green-500 text-xl" />
                        <h3 className="text-lg font-semibold text-gray-900">
                            Qualification completed
                        </h3>
                    </div>
                    <p className="text-gray-500">
                        {qualification.template_name ?? qualification.template_id}
                        {qualification.template_version
                            ? ` · v${qualification.template_version}`
                            : ""}
                        {qualification.completed_at && (
                            <>
                                {" · "}
                                {formatCompanyDateTime(qualification.completed_at)}
                            </>
                        )}
                    </p>
                    {qualification.agent?.name && (
                        <p className="text-sm text-gray-500 mt-1">
                            Agent: {qualification.agent.name}
                        </p>
                    )}
                    {qualification.outcome && (
                        <Tag color="green" className="mt-2">
                            {OUTCOME_LABELS[qualification.outcome] ??
                                qualification.outcome}
                        </Tag>
                    )}
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={onStartNew}
                >
                    Start new qualification
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-8">
                    <Spin />
                </div>
            ) : (
                <Descriptions bordered size="small" column={1}>
                    {(qualification.answers ?? []).map((answer) => {
                        const segment = tree?.segments.find(
                            (s) => s.key === answer.segment_key,
                        );
                        const display = formatAnswerDisplay(segment, {
                            answer_values: answer.answer_values,
                            answer_text: answer.answer_text,
                        });
                        return (
                            <Descriptions.Item
                                key={answer.segment_key}
                                label={segment?.label ?? answer.segment_key}
                            >
                                {display || "—"}
                            </Descriptions.Item>
                        );
                    })}
                </Descriptions>
            )}

            {historyItems.length > 0 && (
                <Collapse
                    items={[
                        {
                            key: "history",
                            label: `Previous qualifications (${historyItems.length})`,
                            children: (
                                <Collapse items={historyItems} bordered={false} />
                            ),
                        },
                    ]}
                />
            )}
        </div>
    );
};

export default CompletedRecap;
