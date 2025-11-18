import React, { useState, useCallback } from "react";
import {
    Card,
    List,
    Tag,
    Button,
    Progress,
    Avatar,
    Tooltip,
    Space,
    Input,
    Select,
    message,
    Modal,
    Form,
    Alert,
    Badge,
} from "antd";
import {
    ExclamationCircleOutlined,
    EditOutlined,
    CheckOutlined,
    UserOutlined,
    PhoneOutlined,
    MailOutlined,
    BankOutlined,
    CalendarOutlined,
    DollarOutlined,
    WarningOutlined,
    InfoCircleOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import { router } from "@inertiajs/react";

interface DataQualityIssue {
    field: string;
    issue: string;
    severity: "high" | "medium" | "low";
    suggestion?: string;
}

interface DataQualityRecord {
    id: number;
    type: "deal" | "lead";
    name: string;
    data_quality_score: number;
    missing_fields: string[];
    data_issues: DataQualityIssue[];
    contact?: {
        id: number;
        client_name: string;
        client_email?: string;
        mobile?: string;
    };
    value?: number;
    stage?: string;
    agent?: {
        id: number;
        name: string;
        image?: string;
    };
    updated_at: string;
    priority_score: number; // Calculated based on value, stage, and data quality
}

interface DataQualityPanelProps {
    records: DataQualityRecord[];
    onRecordUpdate?: (
        recordId: number,
        recordType: "deal" | "lead",
        updates: any
    ) => Promise<void>;
    onBulkFix?: (
        recordIds: number[],
        recordType: "deal" | "lead"
    ) => Promise<void>;
    loading?: boolean;
}

interface QuickFixFormData {
    [key: string]: any;
}

const DataQualityPanel: React.FC<DataQualityPanelProps> = ({
    records = [],
    onRecordUpdate,
    onBulkFix,
    loading = false,
}) => {
    const [selectedRecord, setSelectedRecord] =
        useState<DataQualityRecord | null>(null);
    const [form] = Form.useForm<QuickFixFormData>();
    const [processingRecords, setProcessingRecords] = useState<Set<number>>(
        new Set()
    );
    const [selectedRecords, setSelectedRecords] = useState<Set<number>>(
        new Set()
    );

    const getScoreColor = (score: number) => {
        if (score >= 80) return "#10b981"; // Green
        if (score >= 60) return "#f59e0b"; // Amber
        if (score >= 40) return "#ef4444"; // Red
        return "#dc2626"; // Dark red
    };

    const getScoreLabel = (score: number) => {
        if (score >= 80) return "Good";
        if (score >= 60) return "Fair";
        if (score >= 40) return "Poor";
        return "Critical";
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case "high":
                return "error";
            case "medium":
                return "warning";
            case "low":
                return "default";
            default:
                return "default";
        }
    };

    const getFieldIcon = (field: string) => {
        if (field.includes("email")) return <MailOutlined />;
        if (field.includes("phone") || field.includes("mobile"))
            return <PhoneOutlined />;
        if (field.includes("company")) return <BankOutlined />;
        if (field.includes("date")) return <CalendarOutlined />;
        if (field.includes("value") || field.includes("amount"))
            return <DollarOutlined />;
        return <InfoCircleOutlined />;
    };

    const handleQuickFix = useCallback(
        async (values: QuickFixFormData) => {
            if (!selectedRecord || !onRecordUpdate) return;

            setProcessingRecords((prev) =>
                new Set(prev).add(selectedRecord.id)
            );

            try {
                await onRecordUpdate(
                    selectedRecord.id,
                    selectedRecord.type,
                    values
                );
                message.success(
                    `${
                        selectedRecord.type === "deal" ? "Deal" : "Lead"
                    } updated successfully`
                );
                setSelectedRecord(null);
                form.resetFields();
            } catch (error) {
                message.error("Failed to update record");
            } finally {
                setProcessingRecords((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(selectedRecord.id);
                    return newSet;
                });
            }
        },
        [selectedRecord, onRecordUpdate, form]
    );

    const handleBulkFix = useCallback(
        async (recordType: "deal" | "lead") => {
            if (selectedRecords.size === 0 || !onBulkFix) return;

            const recordsOfType = Array.from(selectedRecords).filter(
                (id) => records.find((r) => r.id === id)?.type === recordType
            );

            if (recordsOfType.length === 0) return;

            try {
                await onBulkFix(recordsOfType, recordType);
                message.success(
                    `${recordsOfType.length} ${recordType}s updated successfully`
                );
                setSelectedRecords(new Set());
            } catch (error) {
                message.error("Failed to bulk update records");
            }
        },
        [selectedRecords, records, onBulkFix]
    );

    const openQuickFix = (record: DataQualityRecord) => {
        setSelectedRecord(record);

        // Pre-fill form with existing data
        const initialValues: QuickFixFormData = {};

        // Add existing contact data
        if (record.contact) {
            initialValues.client_name = record.contact.client_name;
            initialValues.client_email = record.contact.client_email;
            initialValues.mobile = record.contact.mobile;
        }

        // Add deal-specific data
        if (record.type === "deal" && record.value) {
            initialValues.value = record.value;
        }

        form.setFieldsValue(initialValues);
    };

    const toggleRecordSelection = (recordId: number) => {
        setSelectedRecords((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(recordId)) {
                newSet.delete(recordId);
            } else {
                newSet.add(recordId);
            }
            return newSet;
        });
    };

    const renderDataIssue = (issue: DataQualityIssue, index: number) => (
        <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-start space-x-2 p-2 rounded-lg bg-gray-50 mb-2"
        >
            <div className="text-lg">{getFieldIcon(issue.field)}</div>
            <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-sm capitalize">
                        {issue.field.replace(/_/g, " ")}
                    </span>
                    <Tag color={getSeverityColor(issue.severity)}>
                        {issue.severity}
                    </Tag>
                </div>
                <div className="text-xs text-gray-600">{issue.issue}</div>
                {issue.suggestion && (
                    <div className="text-xs text-blue-600 mt-1 italic">
                        💡 {issue.suggestion}
                    </div>
                )}
            </div>
        </motion.div>
    );

    const renderRecord = (record: DataQualityRecord, index: number) => {
        const isProcessing = processingRecords.has(record.id);
        const isSelected = selectedRecords.has(record.id);
        const highPriorityIssues =
            record.data_issues?.filter((issue) => issue.severity === "high")
                .length || 0;

        return (
            <motion.div
                key={record.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="mb-4"
            >
                <Card
                    size="small"
                    loading={isProcessing}
                    className={`transition-all duration-200 cursor-pointer ${
                        isSelected
                            ? "border-blue-400 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300 hover:shadow-md"
                    } ${
                        record.data_quality_score < 40
                            ? "border-l-4 border-l-red-500"
                            : record.data_quality_score < 60
                            ? "border-l-4 border-l-amber-500"
                            : ""
                    }`}
                    onClick={() => toggleRecordSelection(record.id)}
                >
                    <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                    <Badge
                                        count={highPriorityIssues}
                                        color="red"
                                        size="small"
                                        showZero={false}
                                    >
                                        <Tag
                                            color={
                                                record.type === "deal"
                                                    ? "green"
                                                    : "blue"
                                            }
                                        >
                                            {record.type.toUpperCase()}
                                        </Tag>
                                    </Badge>
                                    <span className="font-medium text-gray-900">
                                        {record.name}
                                    </span>
                                </div>

                                {record.contact && (
                                    <div className="text-sm text-gray-600">
                                        {record.contact.client_name}
                                        {record.contact.client_email && (
                                            <span className="ml-2">
                                                • {record.contact.client_email}
                                            </span>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                    {record.value && (
                                        <span className="flex items-center">
                                            <DollarOutlined className="mr-1" />$
                                            {record.value.toLocaleString()}
                                        </span>
                                    )}
                                    {record.stage && (
                                        <span>{record.stage}</span>
                                    )}
                                    {record.agent && (
                                        <div className="flex items-center">
                                            <Avatar
                                                size="small"
                                                src={record.agent.image}
                                                icon={<UserOutlined />}
                                                className="mr-1"
                                            />
                                            <span>{record.agent.name}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="flex items-center space-x-2 mb-2">
                                    <Tooltip
                                        title={`Data Quality: ${getScoreLabel(
                                            record.data_quality_score
                                        )}`}
                                    >
                                        <Progress
                                            type="circle"
                                            size={40}
                                            percent={record.data_quality_score}
                                            strokeColor={getScoreColor(
                                                record.data_quality_score
                                            )}
                                            trailColor="#e5e7eb"
                                            format={(percent) => `${percent}%`}
                                        />
                                    </Tooltip>
                                </div>
                            </div>
                        </div>

                        {/* Missing Fields */}
                        {record.missing_fields &&
                            record.missing_fields.length > 0 && (
                                <div>
                                    <div className="text-xs font-medium text-red-600 mb-2 flex items-center">
                                        <WarningOutlined className="mr-1" />
                                        Missing Required Fields:
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {record.missing_fields.map(
                                            (field, index) => (
                                                <Tag key={index} color="error">
                                                    {field.replace(/_/g, " ")}
                                                </Tag>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}

                        {/* Data Issues */}
                        {record.data_issues &&
                            record.data_issues.length > 0 && (
                                <div>
                                    <div className="text-xs font-medium text-amber-600 mb-2 flex items-center">
                                        <ExclamationCircleOutlined className="mr-1" />
                                        Data Quality Issues:
                                    </div>
                                    <div className="space-y-1">
                                        {record.data_issues
                                            .slice(0, 3)
                                            .map(renderDataIssue)}
                                        {record.data_issues.length > 3 && (
                                            <div className="text-xs text-gray-500 text-center py-1">
                                                +{record.data_issues.length - 3}{" "}
                                                more issues
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            <div className="text-xs text-gray-500">
                                Priority Score: {record.priority_score}/100
                            </div>

                            <Space size="small">
                                <Button
                                    size="small"
                                    type="primary"
                                    icon={<EditOutlined />}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openQuickFix(record);
                                    }}
                                    className="text-xs"
                                >
                                    Quick Fix
                                </Button>

                                <Button
                                    size="small"
                                    type="text"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const route_name =
                                            record.type === "deal"
                                                ? "deals.show"
                                                : "leads.show";
                                        router.visit(
                                            route(route_name, record.id)
                                        );
                                    }}
                                    className="text-xs"
                                >
                                    View Details
                                </Button>
                            </Space>
                        </div>
                    </div>
                </Card>
            </motion.div>
        );
    };

    // Sort records by priority score and data quality score
    const sortedRecords = [...records].sort((a, b) => {
        // First by priority score (higher first)
        if (a.priority_score !== b.priority_score) {
            return b.priority_score - a.priority_score;
        }
        // Then by data quality score (lower first - worse quality first)
        return a.data_quality_score - b.data_quality_score;
    });

    const criticalRecords = sortedRecords.filter(
        (r) => r.data_quality_score < 40
    );
    const poorRecords = sortedRecords.filter(
        (r) => r.data_quality_score >= 40 && r.data_quality_score < 60
    );
    const fairRecords = sortedRecords.filter(
        (r) => r.data_quality_score >= 60 && r.data_quality_score < 80
    );

    const averageScore =
        records.length > 0
            ? Math.round(
                  records.reduce((sum, r) => sum + r.data_quality_score, 0) /
                      records.length
              )
            : 0;

    return (
        <>
            <Card
                title={
                    <div className="flex items-center justify-between">
                        <span>Data Quality Monitor</span>
                        <div className="flex items-center space-x-4">
                            <div className="text-sm font-normal">
                                <span className="text-gray-600">
                                    Average Score:{" "}
                                </span>
                                <span
                                    className={`font-bold ${
                                        averageScore >= 70
                                            ? "text-green-600"
                                            : averageScore >= 50
                                            ? "text-amber-600"
                                            : "text-red-600"
                                    }`}
                                >
                                    {averageScore}%
                                </span>
                            </div>
                            <Tag color="red">
                                {criticalRecords.length} critical
                            </Tag>
                            <Tag color="orange">{poorRecords.length} poor</Tag>
                            <Tag color="blue">{fairRecords.length} fair</Tag>
                        </div>
                    </div>
                }
                loading={loading}
                className="h-full"
                extra={
                    selectedRecords.size > 0 && (
                        <Space>
                            <span className="text-sm text-gray-600">
                                {selectedRecords.size} selected
                            </span>
                            <Button
                                size="small"
                                type="primary"
                                onClick={() => handleBulkFix("deal")}
                            >
                                Bulk Fix Deals
                            </Button>
                            <Button
                                size="small"
                                type="primary"
                                onClick={() => handleBulkFix("lead")}
                            >
                                Bulk Fix Leads
                            </Button>
                        </Space>
                    )
                }
            >
                <div className="space-y-4">
                    {/* Summary Alert */}
                    {criticalRecords.length > 0 && (
                        <Alert
                            message={`${criticalRecords.length} records need immediate attention`}
                            description="These records have critical data quality issues that may affect sales performance"
                            type="error"
                            showIcon
                            closable
                        />
                    )}

                    {/* Records List */}
                    <div className="max-h-96 overflow-y-auto space-y-2">
                        {sortedRecords.length > 0 ? (
                            sortedRecords.map((record, index) =>
                                renderRecord(record, index)
                            )
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <CheckOutlined className="text-4xl text-green-400 mb-2" />
                                <div>All records have good data quality!</div>
                                <div className="text-sm">
                                    Keep up the great work maintaining clean
                                    data.
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* Quick Fix Modal */}
            <Modal
                title={`Quick Fix: ${selectedRecord?.name}`}
                open={!!selectedRecord}
                onCancel={() => {
                    setSelectedRecord(null);
                    form.resetFields();
                }}
                footer={null}
                width={600}
            >
                {selectedRecord && (
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleQuickFix}
                        className="pt-4"
                    >
                        {/* Contact Information */}
                        <div className="mb-4">
                            <h4 className="font-medium mb-3">
                                Contact Information
                            </h4>

                            <Form.Item name="client_name" label="Contact Name">
                                <Input placeholder="Enter contact name" />
                            </Form.Item>

                            <Form.Item
                                name="client_email"
                                label="Email Address"
                                rules={[
                                    {
                                        type: "email",
                                        message: "Please enter a valid email",
                                    },
                                ]}
                            >
                                <Input placeholder="Enter email address" />
                            </Form.Item>

                            <Form.Item name="mobile" label="Phone Number">
                                <Input placeholder="Enter phone number" />
                            </Form.Item>
                        </div>

                        {/* Deal-specific fields */}
                        {selectedRecord.type === "deal" && (
                            <div className="mb-4">
                                <h4 className="font-medium mb-3">
                                    Deal Information
                                </h4>

                                <Form.Item name="value" label="Deal Value">
                                    <Input
                                        type="number"
                                        placeholder="Enter deal value"
                                        prefix="$"
                                    />
                                </Form.Item>

                                <Form.Item
                                    name="close_date"
                                    label="Expected Close Date"
                                >
                                    <Input type="date" />
                                </Form.Item>

                                <Form.Item
                                    name="probability"
                                    label="Probability (%)"
                                >
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        placeholder="Enter probability"
                                        suffix="%"
                                    />
                                </Form.Item>
                            </div>
                        )}

                        {/* Lead-specific fields */}
                        {selectedRecord.type === "lead" && (
                            <div className="mb-4">
                                <h4 className="font-medium mb-3">
                                    Lead Information
                                </h4>

                                <Form.Item
                                    name="company_name"
                                    label="Company Name"
                                >
                                    <Input placeholder="Enter company name" />
                                </Form.Item>

                                <Form.Item name="website" label="Website">
                                    <Input placeholder="Enter website URL" />
                                </Form.Item>

                                <Form.Item name="city" label="City">
                                    <Input placeholder="Enter city" />
                                </Form.Item>

                                <Form.Item name="source" label="Lead Source">
                                    <Select placeholder="Select lead source">
                                        <Select.Option value="website">
                                            Website
                                        </Select.Option>
                                        <Select.Option value="referral">
                                            Referral
                                        </Select.Option>
                                        <Select.Option value="social_media">
                                            Social Media
                                        </Select.Option>
                                        <Select.Option value="cold_call">
                                            Cold Call
                                        </Select.Option>
                                        <Select.Option value="email">
                                            Email Campaign
                                        </Select.Option>
                                    </Select>
                                </Form.Item>
                            </div>
                        )}

                        <div className="flex justify-end space-x-2 pt-4 border-t">
                            <Button
                                onClick={() => {
                                    setSelectedRecord(null);
                                    form.resetFields();
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={
                                    selectedRecord
                                        ? processingRecords.has(
                                              selectedRecord.id
                                          )
                                        : false
                                }
                            >
                                Update Record
                            </Button>
                        </div>
                    </Form>
                )}
            </Modal>
        </>
    );
};

export default DataQualityPanel;
