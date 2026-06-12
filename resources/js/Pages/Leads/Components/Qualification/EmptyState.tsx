import React, { useEffect, useState } from "react";
import { Button, Select, Spin, Empty, Card } from "antd";
import { PlayCircleOutlined } from "@ant-design/icons";
import { PublishedTemplate } from "@/Types/qualification";
import { QualificationTemplateService } from "@/Services/QualificationTemplateService";
import { LeadQualificationService } from "@/Services/LeadQualificationService";
import { LeadQualification } from "@/Types/qualification";

interface EmptyStateProps {
    leadId: number;
    templateService: QualificationTemplateService;
    qualificationService: LeadQualificationService;
    onStarted: (qualification: LeadQualification) => void;
}

const LANGUAGE_OPTIONS = [
    { value: "en", label: "English" },
    { value: "de", label: "German" },
    { value: "tr", label: "Turkish" },
    { value: "ru", label: "Russian" },
];

const EmptyState: React.FC<EmptyStateProps> = ({
    leadId,
    templateService,
    qualificationService,
    onStarted,
}) => {
    const [templates, setTemplates] = useState<PublishedTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
    const [agentLanguage, setAgentLanguage] = useState("en");

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const response =
                    await templateService.getPublishedTemplates();
                const list = response.data ?? [];
                setTemplates(list);
                if (list.length === 1) {
                    setSelectedTemplateId(list[0].id);
                }
            } catch {
                setTemplates([]);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [templateService]);

    const handleStart = async () => {
        const template = templates.find((t) => t.id === selectedTemplateId);
        if (!template) return;

        setStarting(true);
        try {
            const qualification =
                await qualificationService.startQualification(leadId, {
                    template_id: template.id,
                    template_version: template.version,
                    template_name: template.name,
                    agent_language: agentLanguage,
                });
            onStarted(qualification);
        } finally {
            setStarting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <Spin size="large" />
            </div>
        );
    }

    if (templates.length === 0) {
        return (
            <Empty
                className="py-16"
                description="No published qualification templates available"
            />
        );
    }

    return (
        <div className="p-8 max-w-lg mx-auto">
            <Card variant="outlined" className="text-center">
                <PlayCircleOutlined className="text-5xl text-blue-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Start qualification
                </h3>
                <p className="text-gray-500 mb-6">
                    Select a script template and your call language to begin.
                </p>
                <div className="space-y-4 text-left">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Template
                        </label>
                        <Select
                            className="w-full"
                            placeholder="Select template"
                            value={selectedTemplateId}
                            onChange={setSelectedTemplateId}
                            options={templates.map((t) => ({
                                value: t.id,
                                label: t.name,
                            }))}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Script language
                        </label>
                        <Select
                            className="w-full"
                            value={agentLanguage}
                            onChange={setAgentLanguage}
                            options={LANGUAGE_OPTIONS}
                        />
                    </div>
                    <Button
                        type="primary"
                        size="large"
                        block
                        icon={<PlayCircleOutlined />}
                        loading={starting}
                        disabled={!selectedTemplateId}
                        onClick={handleStart}
                    >
                        Start qualification
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default EmptyState;
