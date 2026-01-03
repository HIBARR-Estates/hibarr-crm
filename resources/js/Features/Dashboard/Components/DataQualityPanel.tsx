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
import QuickFixModal from "./QuickFixModal";
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
import { Link, router } from "@inertiajs/react";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";

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

interface DataQualityStats {
    total: number;
    critical: number;
    poor: number;
    fair: number;
    average_score: number;
}

interface DataQualityPanelProps {
    records: DataQualityRecord[];
    stats?: DataQualityStats;
    loading?: boolean;
    products?: any[];
    packages?: any[];
    countries?: any[];
}

interface QuickFixFormData {
    [key: string]: any;
}
const determineAppropriateRecordRoute = (record: DataQualityRecord): string => {
    if (record.type === "deal") {
        return route("deals.show", record.id);
    } else {
        return route("lead-contact.show", record.id);
    }
};
const DataQualityPanel: React.FC<DataQualityPanelProps> = ({
    records = [],
    stats,
    loading = false,
    products = [],
    packages = [],
    countries = [],
}) => {
    const {
        action,
        handleAction,
        handleClose,
        selected: selectedRecord,
    } = useGenericEntityAction<DataQualityRecord>();
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

    const handleQuickFix = (record: DataQualityRecord) => {
        handleAction("quick_update", record);
    };

    const renderDataIssue = (issue: DataQualityIssue, index: number) => (
        <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-start gap-x-2 p-2 rounded-lg bg-gray-50 mb-2"
        >
            <div className="text-lg">{getFieldIcon(issue.field)}</div>
            <div className="flex-1">
                <div className="flex items-center gap-x-2 mb-1">
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
        const highPriorityIssues =
            record.data_issues?.filter((issue) => issue.severity === "high")
                .length || 0;

        return (
            <motion.div
                key={record.id + "-" + index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="mb-4"
            >
                <Card
                    variant="outlined"
                    size="small"
                    className={`transition-all duration-200 ${
                        record.data_quality_score < 40
                            ? "border-l-4 border-l-red-500"
                            : record.data_quality_score < 60
                            ? "border-l-4 border-l-amber-500"
                            : ""
                    }`}
                >
                    <div className="flex flex-col gap-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-x-2 mb-1">
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
                                    <Link
                                        href={determineAppropriateRecordRoute(
                                            record
                                        )}
                                        className="hover:underline"
                                    >
                                        {record.name}
                                    </Link>
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

                                <div className="flex items-center gap-x-4 mt-2 text-xs text-gray-500">
                                    {record.value && (
                                        <span className="flex items-center">
                                            <DollarOutlined className="mr-1" />$
                                            {record.value.toLocaleString()}
                                        </span>
                                    )}
                                    {record.stage && (
                                        <span>{record.stage}</span>
                                    )}
                                    {/* {record.agent && (
                                        <div className="flex items-center">
                                            <Avatar
                                                size="small"
                                                src={record.agent.image}
                                                icon={<UserOutlined />}
                                                className="mr-1"
                                            />
                                            <span>{record.agent.name}</span>
                                        </div>
                                    )} */}
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="flex items-center gap-x-2 mb-2">
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
                        {/* {record.data_issues &&
                            record.data_issues.length > 0 && (
                                <div>
                                    <div className="text-xs font-medium text-amber-600 mb-2 flex items-center">
                                        <ExclamationCircleOutlined className="mr-1" />
                                        Data Quality Issues:
                                    </div>
                                    <div className="flex flex-col gap-y-1">
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
                            )} */}

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            <div className="text-xs text-gray-500">
                                Priority Score: {record.priority_score}/100
                            </div>

                            <Space size="small">
                                <Button
                                    size="small"
                                    type="primary"
                                    onClick={() => {
                                        handleQuickFix(record);
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

                                        router.visit(
                                            determineAppropriateRecordRoute(
                                                record
                                            )
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

    const criticalCount =
        stats?.critical ??
        sortedRecords.filter((r) => r.data_quality_score < 40).length;
    const poorCount =
        stats?.poor ??
        sortedRecords.filter(
            (r) => r.data_quality_score >= 40 && r.data_quality_score < 60
        ).length;
    const fairCount =
        stats?.fair ??
        sortedRecords.filter(
            (r) => r.data_quality_score >= 60 && r.data_quality_score < 80
        ).length;

    const averageScore =
        stats?.average_score ??
        (records.length > 0
            ? Math.round(
                  records.reduce((sum, r) => sum + r.data_quality_score, 0) /
                      records.length
              )
            : 0);

    return (
        <>
            <Card
                variant="outlined"
                title={
                    <div className="flex items-center justify-between">
                        <span>Data Quality Monitor</span>
                        <div className="flex items-center gap-x-4">
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
                            <Tag color="red">{criticalCount} critical</Tag>
                            <Tag color="orange">{poorCount} poor</Tag>
                            <Tag color="blue">{fairCount} fair</Tag>
                        </div>
                    </div>
                }
                loading={loading}
                className="h-full"
            >
                <div className="flex flex-col gap-y-4">
                    {/* Summary Alert */}
                    {criticalCount > 0 && (
                        <Alert
                            message={`${criticalCount} records need immediate attention`}
                            description="These records have critical data quality issues that may affect sales performance"
                            type="error"
                            showIcon
                            closable
                        />
                    )}

                    {/* Records List */}
                    <div className="max-h-96 overflow-y-auto flex flex-col gap-y-2">
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
            <QuickFixModal
                record={selectedRecord}
                open={action === "quick_update"}
                onClose={() => handleClose()}
                products={products}
                packages={packages}
                countries={countries}
            />
        </>
    );
};

export default DataQualityPanel;
