import React, { useCallback, useMemo, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import {
    Button,
    Card,
    Input,
    Modal,
    Popconfirm,
    Space,
    Tag,
    Typography,
    message,
} from "antd";
import { DeleteOutlined, EyeOutlined } from "@ant-design/icons";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { AgentReportSummary } from "@/Types/api";
import dayjs from "dayjs";
import {
    formatCompanyDate,
    formatCompanyDateTime,
} from "@/lib/companyDateTime";
import { marked } from "marked";
import DOMPurify from "dompurify";
import DeleteSummary from "../components/DeleteSummary";
import { DataTable } from "@/Components/DataTable";
import type { LaravelPaginationMeta } from "@/Components/DataTable";

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
    const [deleting, setDeleting] = useState<AgentReportSummary | null>(null);

    const renderMarkdown = useCallback((content: string) => {
        const html = marked.parse(content, {
            breaks: true,
            gfm: true,
        }) as string;

        return {
            __html: DOMPurify.sanitize(html),
        };
    }, []);

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
                    formatCompanyDateTime(value, { fallback: "-" }),
            },
            {
                title: "Filters",
                key: "filters",
                render: (_: unknown, row: AgentReportSummary) => (
                    <Space direction="vertical" size={2}>
                        <span className="text-xs text-gray-500">
                            {formatCompanyDate(row.filter_start_date)}{" "}
                            to{" "}
                            {formatCompanyDate(row.filter_end_date)}
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

                        <Button
                            size="small"
                            onClick={() => setDeleting(row)}
                            danger
                            icon={<DeleteOutlined />}
                        >
                            Delete
                        </Button>
                    </Space>
                ),
            },
        ],
        [],
    );

    return (
        <DashboardLayout>
            <DeleteSummary
                onClose={() => setDeleting(null)}
                open={!!deleting}
                summary={deleting}
            />
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
                                    router.get(
                                        "/account/agent-reports",
                                        {},
                                        {
                                            preserveScroll: true,
                                        },
                                    )
                                }
                            >
                                Back to Reports
                            </Button>
                        </Space>
                    }
                >
                    <DataTable
                        rowKey="id"
                        dataSource={summaries.data}
                        columns={columns as any}
                        paginationData={{
                            current_page: summaries.current_page,
                            last_page: summaries.last_page,
                            per_page: summaries.per_page,
                            total: summaries.total,
                            from: null,
                            to: null,
                        } as LaravelPaginationMeta}
                        onPageChange={(page) => applyFilters({ page })}
                        scroll={{ x: 1000, y: "calc(100vh - 280px)" }}
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
                        <Space
                            direction="vertical"
                            size={12}
                            className="w-full"
                        >
                            <Space wrap className="capitalize">
                                <Tag color="blue">
                                    {viewing.filter_view_type}
                                </Tag>
                                <Tag>
                                    {formatCompanyDate(viewing.filter_start_date)}{" "}
                                    to{" "}
                                    {formatCompanyDate(viewing.filter_end_date)}
                                </Tag>
                                <Tag>{viewing.context_label}</Tag>
                                <Tag>
                                    Created by{" "}
                                    {viewing.added_by?.name || "Unknown"}
                                </Tag>
                            </Space>

                            {viewing.description && (
                                <Typography.Paragraph type="secondary">
                                    {viewing.description}
                                </Typography.Paragraph>
                            )}

                            <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 max-h-[50vh] overflow-auto">
                                <div
                                    className="leading-relaxed space-y-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_code]:rounded [&_code]:bg-gray-200 [&_code]:px-1 [&_pre]:overflow-auto [&_pre]:rounded [&_pre]:bg-white [&_pre]:p-3 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:text-gray-600 [&_a]:text-blue-600 [&_a]:underline"
                                    dangerouslySetInnerHTML={renderMarkdown(
                                        viewing.summary,
                                    )}
                                />
                            </div>
                        </Space>
                    )}
                </Modal>
            </PageLayout>
        </DashboardLayout>
    );
};

export default Index;
