import React, { useMemo } from "react";
import {
    Form,
    Select,
    AutoComplete,
    Input,
    Button,
    Typography,
    Row,
    Col,
    Tooltip,
} from "antd";
import type { FormInstance } from "antd/lib/form";
import { WhatsAppOutlined, LinkOutlined } from "@ant-design/icons";
import { usePage } from "@inertiajs/react";

const { Text } = Typography;

interface Developer {
    id: number;
    name: string;
    project_list?: string[] | null;
    whatsapp_group_link?: string | null;
}

interface ConstructionProjectInfoSectionProps {
    form: FormInstance;
    developers?: Developer[];
}

/**
 * Construction Company & Project Name selection.
 *
 * - Developer dropdown populates from existing Developer records (which have project_list).
 * - When a developer is selected, the project name dropdown shows its project_list.
 * - WhatsApp group link is inherited from the developer (per-company, not per-project).
 * - Google Drive link is a per-project input.
 *
 * Accepts an optional `developers` prop. Falls back to `usePage().props.developers` if not provided.
 */
const ConstructionProjectInfoSection: React.FC<
    ConstructionProjectInfoSectionProps
> = ({ form, developers: developersProp }) => {
    const { props } = usePage<any>();
    const developers =
        developersProp ?? ((props?.developers || []) as Developer[]);

    const selectedDeveloperId = Form.useWatch("developer_id", form);

    // Find selected developer to get project_list and whatsapp link
    const selectedDeveloper = useMemo(() => {
        if (!selectedDeveloperId) return null;
        return developers.find((d) => d.id === selectedDeveloperId) || null;
    }, [selectedDeveloperId, developers]);

    // Project name options from developer's project_list
    const projectNameOptions = useMemo(() => {
        if (!selectedDeveloper?.project_list) return [];
        return selectedDeveloper.project_list.map((name) => ({
            value: name,
            label: name,
        }));
    }, [selectedDeveloper]);

    const whatsappLink = selectedDeveloper?.whatsapp_group_link;

    // Clear project name when developer changes
    const handleDeveloperChange = (value: number) => {
        form.setFieldValue("name", undefined);
    };

    return (
        <Row gutter={[16, 0]}>
            {/* Construction Company */}
            <Col xs={24} md={12}>
                <Form.Item
                    name="developer_id"
                    label="Construction Company"
                    rules={[
                        {
                            required: true,
                            message: "Please select a construction company",
                        },
                    ]}
                >
                    <Select
                        placeholder="Select construction company"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        onChange={handleDeveloperChange}
                        options={developers.map((d) => ({
                            value: d.id,
                            label: d.name,
                        }))}
                    />
                </Form.Item>
            </Col>

            {/* Project Name */}
            <Col xs={24} md={12}>
                <Form.Item
                    name="name"
                    label="Project Name"
                    rules={[
                        {
                            required: true,
                            message: "Please select or enter a project name",
                        },
                    ]}
                >
                    <AutoComplete
                        placeholder={
                            selectedDeveloperId
                                ? "Type or select a project name"
                                : "Select a company first"
                        }
                        allowClear
                        disabled={!selectedDeveloperId}
                        options={projectNameOptions}
                        filterOption={(inputValue, option) =>
                            ((option?.label as string) ?? "")
                                .toLowerCase()
                                .includes(inputValue.toLowerCase())
                        }
                    />
                </Form.Item>
            </Col>

            {/* Google Drive Link */}
            <Col xs={24} md={12}>
                <Form.Item name="google_drive_link" label="Google Drive Link">
                    <Input
                        placeholder="https://drive.google.com/..."
                        prefix={<LinkOutlined />}
                    />
                </Form.Item>
                {form.getFieldValue("google_drive_link") && (
                    <Button
                        type="link"
                        icon={<LinkOutlined />}
                        href={form.getFieldValue("google_drive_link")}
                        target="_blank"
                        className="mt-[-8px] mb-2"
                        size="small"
                    >
                        Open Google Drive
                    </Button>
                )}
            </Col>

            {/* WhatsApp Group Link — inherited from developer */}
            <Col xs={24} md={12}>
                <Form.Item label="WhatsApp Group">
                    {whatsappLink ? (
                        <Button
                            type="primary"
                            ghost
                            icon={<WhatsAppOutlined />}
                            href={whatsappLink}
                            target="_blank"
                            block
                        >
                            Join this project WhatsApp group
                        </Button>
                    ) : (
                        <Text type="secondary" className="text-xs">
                            {selectedDeveloperId
                                ? "No WhatsApp group link set for this construction company. Configure it in the Developers settings."
                                : "Select a construction company to see WhatsApp group link."}
                        </Text>
                    )}
                </Form.Item>
            </Col>

            {/* Reference Code */}
            {/* <Col xs={24} md={12}>
                <Form.Item
                    name="reference_code"
                    label="Reference Code"
                    tooltip="Auto-generated if left empty (e.g. AKACAN-001)"
                >
                    <Input
                        placeholder="Auto-generated if left empty"
                        maxLength={50}
                    />
                </Form.Item>
            </Col> */}
        </Row>
    );
};

export default ConstructionProjectInfoSection;
