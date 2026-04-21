import { useState } from "react";
import { usePage } from "@inertiajs/react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import {
    Table,
    Tag,
    Button,
    Segmented,
    Space,
    Tooltip,
    Modal,
    Input,
    Empty,
} from "antd";
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    ClockCircleOutlined,
    EyeOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useApiQuery } from "@/lib/api/client";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import type { ApiSuccessResponse } from "@/lib/api/types";

interface PublishRequest {
    id: number;
    property_id: number;
    requesting_agent_id: number;
    company_id: number;
    status: "pending" | "approved" | "rejected";
    message: string | null;
    response_message: string | null;
    reviewed_by: number | null;
    reviewed_at: string | null;
    created_at: string;
    updated_at: string;
    property?: {
        id: number;
        title: string;
        display_title: string;
        reference_code: string;
    };
    requesting_agent?: {
        id: number;
        name: string;
        email: string;
        image: string | null;
    };
    reviewer?: {
        id: number;
        name: string;
        email: string;
    };
}

interface PaginatedResponse {
    data: PublishRequest[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

const statusColors: Record<string, string> = {
    pending: "orange",
    approved: "green",
    rejected: "red",
};

const statusIcons: Record<string, React.ReactNode> = {
    pending: <ClockCircleOutlined />,
    approved: <CheckCircleOutlined />,
    rejected: <CloseCircleOutlined />,
};

const Index = () => {
    const { t } = useTranslation();
    const { props } = usePage<any>();
    const isSalesManager =
        props.auth?.permissions?.edit_product === "all" ||
        props.auth?.permissions?.edit_product === 4;

    const [direction, setDirection] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [page, setPage] = useState(1);

    // Response modal state
    const [respondModal, setRespondModal] = useState<{
        open: boolean;
        action: "approve" | "reject" | null;
        request: PublishRequest | null;
    }>({ open: false, action: null, request: null });
    const [responseMessage, setResponseMessage] = useState("");

    // Detail modal state
    const [detailModal, setDetailModal] = useState<{
        open: boolean;
        request: PublishRequest | null;
    }>({ open: false, request: null });

    // Build query params
    const params: Record<string, string | number> = { page };
    if (direction !== "all") params.direction = direction;
    if (statusFilter) params.status = statusFilter;

    // Fetch requests
    const { data, isLoading, refetch } = useApiQuery<{
        data: PaginatedResponse;
    }>({
        path: route("publish-requests.index"),
        params,
    });

    const requests = data?.data?.data ?? [];
    const pagination = data?.data;

    // Approve mutation
    const { mutate: approveRequest, isPending: isApproving } = useApiMutate<
        { response_message?: string },
        any,
        ApiSuccessResponse<any>
    >(
        respondModal.request
            ? route("publish-requests.approve", respondModal.request.id)
            : "",
        "POST",
        () => {
            setRespondModal({ open: false, action: null, request: null });
            setResponseMessage("");
            refetch();
        },
    );

    // Reject mutation
    const { mutate: rejectRequest, isPending: isRejecting } = useApiMutate<
        { response_message?: string },
        any,
        ApiSuccessResponse<any>
    >(
        respondModal.request
            ? route("publish-requests.reject", respondModal.request.id)
            : "",
        "POST",
        () => {
            setRespondModal({ open: false, action: null, request: null });
            setResponseMessage("");
            refetch();
        },
    );

    const handleRespond = (
        request: PublishRequest,
        action: "approve" | "reject",
    ) => {
        setRespondModal({ open: true, action, request });
    };

    const handleSubmitResponse = () => {
        const payload = responseMessage
            ? { response_message: responseMessage }
            : {};
        if (respondModal.action === "approve") {
            approveRequest(payload);
        } else {
            rejectRequest(payload);
        }
    };

    const columns: ColumnsType<PublishRequest> = [
        {
            title: "Property",
            key: "property",
            render: (_, record) => (
                <div>
                    <a
                        href={`/account/properties/${record.property?.id}`}
                        className="font-medium"
                    >
                        {record.property?.display_title ||
                            record.property?.title ||
                            "N/A"}
                    </a>
                    {record.property?.reference_code && (
                        <div className="text-xs text-gray-500">
                            {record.property.reference_code}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: "Requesting Agent",
            key: "requesting_agent",
            render: (_, record) => (
                <span>{record.requesting_agent?.name || "Unknown"}</span>
            ),
        },
        {
            title: "Status",
            key: "status",
            width: 130,
            render: (_, record) => (
                <Tag
                    icon={statusIcons[record.status]}
                    color={statusColors[record.status]}
                >
                    {record.status.charAt(0).toUpperCase() +
                        record.status.slice(1)}
                </Tag>
            ),
        },
        {
            title: "Message",
            key: "message",
            ellipsis: true,
            render: (_, record) => (
                <span className="text-gray-600">
                    {record.message || (
                        <span className="italic text-gray-400">No message</span>
                    )}
                </span>
            ),
        },
        {
            title: "Submitted",
            key: "created_at",
            width: 160,
            render: (_, record) => {
                const date = new Date(record.created_at);
                return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                });
            },
        },
        {
            title: "Reviewer",
            key: "reviewer",
            width: 150,
            render: (_, record) => (
                <span>
                    {record.reviewer?.name || (
                        <span className="text-gray-400 italic">-</span>
                    )}
                </span>
            ),
        },
        {
            title: "Actions",
            key: "actions",
            width: 200,
            render: (_, record) => (
                <Space>
                    <Tooltip title="View details">
                        <Button
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() =>
                                setDetailModal({ open: true, request: record })
                            }
                        />
                    </Tooltip>
                    {isSalesManager && record.status === "pending" && (
                        <>
                            <Button
                                size="small"
                                type="primary"
                                onClick={() => handleRespond(record, "approve")}
                            >
                                Approve
                            </Button>
                            <Button
                                size="small"
                                danger
                                onClick={() => handleRespond(record, "reject")}
                            >
                                Reject
                            </Button>
                        </>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title={t("app.properties.actions.publish_requests")}
                breadcrumbs={[
                    { name: t("app.menu.properties"), url: route("properties.index") },
                    { name: t("app.properties.actions.publish_requests") },
                ]}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
                        <Segmented
                            options={[
                                { label: "All", value: "all" },
                                { label: "My Requests", value: "mine" },
                                ...(isSalesManager
                                    ? [
                                          {
                                              label: "Pending Review",
                                              value: "pending_review",
                                          },
                                      ]
                                    : []),
                            ]}
                            value={direction}
                            onChange={(val) => {
                                setDirection(val as string);
                                setPage(1);
                            }}
                        />
                        <Space>
                            <Segmented
                                options={[
                                    { label: "All Statuses", value: "" },
                                    { label: "Pending", value: "pending" },
                                    { label: "Approved", value: "approved" },
                                    { label: "Rejected", value: "rejected" },
                                ]}
                                value={statusFilter}
                                onChange={(val) => {
                                    setStatusFilter(val as string);
                                    setPage(1);
                                }}
                            />
                        </Space>
                    </div>

                    <Table
                        dataSource={requests}
                        columns={columns}
                        rowKey="id"
                        loading={isLoading}
                        pagination={
                            pagination
                                ? {
                                      current: pagination.current_page,
                                      pageSize: pagination.per_page,
                                      total: pagination.total,
                                      showSizeChanger: false,
                                      onChange: (p) => setPage(p),
                                  }
                                : false
                        }
                        locale={{
                            emptyText: (
                                <Empty
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    description="No publish requests yet"
                                />
                            ),
                        }}
                    />
                </div>

                {/* Approve/Reject Response Modal */}
                <Modal
                    title={
                        respondModal.action === "approve"
                            ? "Approve Publish Request"
                            : "Reject Publish Request"
                    }
                    open={respondModal.open}
                    onOk={handleSubmitResponse}
                    onCancel={() => {
                        if (!isApproving && !isRejecting) {
                            setRespondModal({
                                open: false,
                                action: null,
                                request: null,
                            });
                            setResponseMessage("");
                        }
                    }}
                    confirmLoading={isApproving || isRejecting}
                    okText={
                        respondModal.action === "approve" ? "Approve" : "Reject"
                    }
                    okButtonProps={{
                        danger: respondModal.action === "reject",
                    }}
                >
                    {respondModal.request && (
                        <div className="py-2">
                            <p className="mb-2">
                                <strong>Property:</strong>{" "}
                                {respondModal.request.property?.display_title ||
                                    respondModal.request.property?.title}
                            </p>
                            <p className="mb-2 text-gray-500 text-sm">
                                <strong>Ref:</strong>{" "}
                                {respondModal.request.property?.reference_code}
                            </p>
                            <p className="mb-2">
                                <strong>Requesting Agent:</strong>{" "}
                                {respondModal.request.requesting_agent?.name}
                            </p>
                            {respondModal.request.message && (
                                <p className="mb-3 text-gray-600">
                                    <strong>Agent&apos;s Message:</strong>{" "}
                                    {respondModal.request.message}
                                </p>
                            )}
                            <Input.TextArea
                                placeholder={
                                    respondModal.action === "approve"
                                        ? "Optional message to the agent"
                                        : "Optional reason for rejection"
                                }
                                value={responseMessage}
                                onChange={(e) =>
                                    setResponseMessage(e.target.value)
                                }
                                rows={3}
                                maxLength={1000}
                                showCount
                            />
                        </div>
                    )}
                </Modal>

                {/* Detail Modal */}
                <Modal
                    title="Publish Request Details"
                    open={detailModal.open}
                    onCancel={() =>
                        setDetailModal({ open: false, request: null })
                    }
                    footer={null}
                    width={500}
                >
                    {detailModal.request && (
                        <div className="py-2 space-y-3">
                            <div>
                                <span className="text-gray-500 text-sm">
                                    Property
                                </span>
                                <div className="font-medium">
                                    {detailModal.request.property
                                        ?.display_title ||
                                        detailModal.request.property?.title}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {
                                        detailModal.request.property
                                            ?.reference_code
                                    }
                                </div>
                            </div>
                            <div>
                                <span className="text-gray-500 text-sm">
                                    Requesting Agent
                                </span>
                                <div>
                                    {detailModal.request.requesting_agent?.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {
                                        detailModal.request.requesting_agent
                                            ?.email
                                    }
                                </div>
                            </div>
                            <div>
                                <span className="text-gray-500 text-sm">
                                    Status
                                </span>
                                <div>
                                    <Tag
                                        icon={
                                            statusIcons[
                                                detailModal.request.status
                                            ]
                                        }
                                        color={
                                            statusColors[
                                                detailModal.request.status
                                            ]
                                        }
                                    >
                                        {detailModal.request.status
                                            .charAt(0)
                                            .toUpperCase() +
                                            detailModal.request.status.slice(1)}
                                    </Tag>
                                </div>
                            </div>
                            {detailModal.request.message && (
                                <div>
                                    <span className="text-gray-500 text-sm">
                                        Agent&apos;s Message
                                    </span>
                                    <div>{detailModal.request.message}</div>
                                </div>
                            )}
                            {detailModal.request.response_message && (
                                <div>
                                    <span className="text-gray-500 text-sm">
                                        Reviewer&apos;s Response
                                    </span>
                                    <div>
                                        {detailModal.request.response_message}
                                    </div>
                                </div>
                            )}
                            {detailModal.request.reviewer && (
                                <div>
                                    <span className="text-gray-500 text-sm">
                                        Reviewed By
                                    </span>
                                    <div>
                                        {detailModal.request.reviewer.name}
                                    </div>
                                </div>
                            )}
                            <div>
                                <span className="text-gray-500 text-sm">
                                    Submitted At
                                </span>
                                <div>
                                    {new Date(
                                        detailModal.request.created_at,
                                    ).toLocaleString()}
                                </div>
                            </div>
                            {detailModal.request.reviewed_at && (
                                <div>
                                    <span className="text-gray-500 text-sm">
                                        Reviewed At
                                    </span>
                                    <div>
                                        {new Date(
                                            detailModal.request.reviewed_at,
                                        ).toLocaleString()}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </Modal>
            </PageLayout>
        </DashboardLayout>
    );
};

export default Index;
