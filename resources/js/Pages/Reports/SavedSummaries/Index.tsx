import React, { useMemo, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import {
    Button,
    Card,
    Input,
    Modal,
    Popconfirm,
    Space,
    Table,
    Tag,
    Typography,
    message,
} from "antd";
import { DeleteOutlined, EyeOutlined } from "@ant-design/icons";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { AgentReportSummary } from "@/Types/api";

interface PaginationData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

interface SavedSummariesPageProps extends PageProps {
    pageTitle: string;
    summaries: PaginationData<AgentReportSummary>;
    filters: {
        search?: string;
        per_page?: number;
    };
    canViewAll: boolean;
}

const Index: React.FC = () => {
    const { props } = usePage<SavedSummariesPageProps>();
    const { pageTitle, summaries, filters } = props;

    const [search, setSearch] = useState(filters.search ?? "");
    const [viewing, setViewing] = useState<AgentReportSummary | null>(null);

    const applyFilters = (extra: Record<string, any> = {}) => {
        router.get(
            "/account/agent-reports/saved-summaries",
            {
                search: search || undefined,
                per_page: summaries.per_page,
                ...extra,
            },
            { preserveState: true, preserveScroll: true },
        );
    };

    const deleteSummary = async (summary: AgentReportSummary) => {
        try {
            await router.delete(
                `/account/agent-reports/saved-summaries/${summary.id}`,
                {
                    preserveScroll: true,
                    onSuccess: () => message.success("Summary deleted."),
                    onError: () => message.error("Unable to delete summary."),
                },
            );
        } catch {
            message.error("Unable to delete summary.");
        }
    };

    const columns = useMemo(
        () => [
            {
                title: "Title",
                dataIndex: "title",
                key: "title",
                render: (_: unknown, row: AgentReportSummary) => (
                    <div>
                        <div className="font-medium text-gray-800">
                            {row.title || "Untitled summary"}
                        </div>
                        {row.description && (
                            <div className="text-xs text-gray-500 line-clamp-2 mt-1">
                                {row.description}
                            </div>
                        )}
                    </div>
                ),
            },
            {
                title: "Created By",
                key: "created_by",
                render: (_: unknown, row: AgentReportSummary) =>
                    row.added_by?.name || "Unknown",
            },
            {
                title: "Created At",
                dataIndex: "created_at",
                key: "created_at",
                render: (value: string) =>
                    value ? new Date(value).toLocaleString() : "-",
            },
            {
                title: "Filters",
                key: "filters",
                render: (_: unknown, row: AgentReportSummary) => (
                    <Space direction="vertical" size={2}>
                        <span className="text-xs text-gray-500">
                            {row.filter_start_date} to {row.filter_end_date}
                        </span>
                        <span className="text-xs text-gray-500">
                            {row.filter_view_type === "department"
                                ? "Department"
                                : "Agent"}
                            {" · "}
                            {row.context_label}
                        </span>
                    </Space>
                ),
            },
            {
                title: "Actions",
                key: "actions",
                width: 160,
                render: (_: unknown, row: AgentReportSummary) => (
                    <Space>
                        <Button
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => setViewing(row)}
                        >
                            View
                        </Button>
                        <Popconfirm
                            title="Delete this summary?"
                            okText="Delete"
                            cancelText="Cancel"
                            onConfirm={() => deleteSummary(row)}
                        >
                            <Button
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                            >
                                Delete
                            </Button>
                        </Popconfirm>
                    </Space>
                ),
            },
        ],
        [],
    );

    return (
        <DashboardLayout>
            <PageLayout
                title={pageTitle}
                breadcrumbs={[
                    { name: "Dashboard", url: "/account/dashboard" },
                    { name: "Reports", url: "/account/agent-reports" },
                    { name: "Saved AI Summaries" },
                ]}
            >
                <Card
                    className="border border-gray-200"
                    title="Saved AI Summaries"
                    extra={
                        <Space>
                            <Input.Search
                                placeholder="Search summaries"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onSearch={() => applyFilters({ page: 1 })}
                                allowClear
                                style={{ width: 260 }}
                            />
                            <Button
                                onClick={() =>
                                    router.get("/account/agent-reports", {}, {
                                        preserveScroll: true,
                                    })
                                }
                            >
                                Back to Reports
                            </Button>
                        </Space>
                    }
                >
                    <Table
                        rowKey="id"
                        dataSource={summaries.data}
                        columns={columns as any}
                        pagination={{
                            current: summaries.current_page,
                            total: summaries.total,
                            pageSize: summaries.per_page,
                            showSizeChanger: false,
                            onChange: (page) => applyFilters({ page }),
                        }}
                    />
                </Card>

                <Modal
                    open={!!viewing}
                    onCancel={() => setViewing(null)}
                    footer={null}
                    title={viewing?.title || "Saved Summary"}
                    width={760}
                >
                    {viewing && (
                        <Space direction="vertical" size={12} className="w-full">
                            <Space wrap>
                                <Tag color="blue">{viewing.filter_view_type}</Tag>
                                <Tag>
                                    {viewing.filter_start_date} to {viewing.filter_end_date}
                                </Tag>
                                <Tag>{viewing.context_label}</Tag>
                                <Tag>
                                    Created by {viewing.added_by?.name || "Unknown"}
                                </Tag>
                            </Space>

                            {viewing.description && (
                                <Typography.Paragraph type="secondary">
                                    {viewing.description}
                                </Typography.Paragraph>
                            )}

                            <div className="rounded border border-gray-200 bg-gray-50 p-3 whitespace-pre-wrap text-sm text-gray-700 max-h-[50vh] overflow-auto">
                                {viewing.summary}
                            </div>
                        </Space>
                    )}
                </Modal>
            </PageLayout>
        </DashboardLayout>
    );
};

export default Index;
