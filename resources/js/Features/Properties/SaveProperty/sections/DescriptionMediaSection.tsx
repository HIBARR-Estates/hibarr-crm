import React, { useCallback } from "react";
import { Form, Input, Row, Col, Button, Alert, App } from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory } from "@/Types";
import { useGenerateDescription } from "@/lib/ai";
import { useTd } from "@/Hooks/useDynamicTranslation";

const { TextArea } = Input;

interface DescriptionMediaSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
    lockedFields?: Set<string>;
}

const DescriptionMediaSection: React.FC<DescriptionMediaSectionProps> = ({
    form,
    primaryCategory,
    lockedFields = new Set<string>(),
}) => {
    const { td } = useTd();
    const { modal } = App.useApp();
    const { isEnabled, isGenerating, error, insufficientMessage, generate } =
        useGenerateDescription();

    const handleGenerate = useCallback(async () => {
        const formData = form.getFieldsValue(true);
        const existingDescription = formData.description;

        const doGenerate = async () => {
            const description = await generate(formData);
            if (description) {
                form.setFieldValue("description", description);
            }
        };

        // If description already has content, confirm before replacing
        if (existingDescription?.trim()) {
            modal.confirm({
                title: td("Replace existing description?", { source: "en" }),
                content:
                    "This will replace your current description with an AI-generated one.",
                okText: "Replace",
                cancelText: "Cancel",
                onOk: doGenerate,
            });
        } else {
            await doGenerate();
        }
    }, [form, generate]);

    return (
        <Row gutter={[16, 0]}>
            {/* Description */}
            <Col span={24}>
                <div className="flex items-center justify-between mb-1">
                    <label className="ant-form-item-label">
                        <span>{td("Description", { source: "en" })}</span>
                    </label>
                    {isEnabled && (
                        <Button
                            size="small"
                            icon={<ThunderboltOutlined />}
                            onClick={handleGenerate}
                            loading={isGenerating}
                            type="default"
                        >
                            {isGenerating ? "Generating…" : "Generate with AI"}
                        </Button>
                    )}
                </div>
                <Form.Item name="description" noStyle>
                    <TextArea
                        rows={4}
                        placeholder={td("Enter a detailed property description...", { source: "en" })}
                        showCount
                        maxLength={5000}
                        disabled={isGenerating || lockedFields.has('description')}
                    />
                </Form.Item>
                {insufficientMessage && (
                    <div className="mt-2">
                        <Alert
                            message={insufficientMessage}
                            type="info"
                            showIcon
                            closable
                        />
                    </div>
                )}
                {error && (
                    <div className="mt-2">
                        <Alert
                            message={error}
                            type="error"
                            showIcon
                            className="mt-2"
                            closable
                        />
                    </div>
                )}
            </Col>

            {/* Video URL */}
            <Col xs={24} md={12}>
                <Form.Item
                    name="video_url"
                    label={td("Video URL", { source: "en" })}
                    rules={[
                        { type: "url", message: "Please enter a valid URL" },
                    ]}
                >
                    <Input placeholder="https://youtube.com/watch?v=..." />
                </Form.Item>
            </Col>

            {/* 360 Tour URL */}
            <Col xs={24} md={12}>
                <Form.Item
                    name="tour_360_url"
                    label={td("360° Tour URL", { source: "en" })}
                    rules={[
                        { type: "url", message: "Please enter a valid URL" },
                    ]}
                >
                    <Input placeholder="https://my.matterport.com/show/..." />
                </Form.Item>
            </Col>
        </Row>
    );
};

export default DescriptionMediaSection;
