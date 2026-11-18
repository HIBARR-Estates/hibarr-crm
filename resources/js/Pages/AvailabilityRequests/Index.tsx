import { useState } from "react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import {
    Tag,
    Button,
    Segmented,
    Space,
    Tooltip,
    Modal,
    Input,
} from "antd";
import type { TableColumnsType } from "antd";
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    EyeOutlined,
} from "@ant-design/icons";
import { DataTable } from "@/Components/DataTable";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
import { useApiQuery } from "@/lib/api/client";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import type { ApiSuccessResponse } from "@/lib/api/types";
import { generatePropertySubtitle } from "@/lib/utils";
import { formatCompanyDateTime } from "@/lib/companyDateTime";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface AvailabilityRequest {
    id: number;
    property_id: number;
    requesting_agent_id: number;
    responsible_agent_id?: number;
    status: "pending" | "approved" | "denied" | "escalated" | "expired";
    message: string | null;
    response_message: string | null;
    responded_at: string | null;
    escalated_at: string | null;
    expires_at: string | null;
    created_at: string;
    property?: {
        id: number;
        title: string;
        reference_code: string;
        city: string;
        area: string;
        status: string;
        property_type: string;
        sale_type: string;
    };
    requesting_agent?: {
        id: number;
        name: string;
        email: string;
        image: string | null;
    };
    responsible_agent?: {
        id: number;
        name: string;
        email: string;
        image: string | null;
    };
}

interface PaginatedResponse {
    data: AvailabilityRequest[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

const statusColors: Record<string, string> = {
    pending: "orange",
    approved: "green",
    denied: "red",
    escalated: "volcano",
    expired: "default",
};

const statusIcons: Record<string, React.ReactNode> = {
    pending: <ClockCircleOutlined />,
    approved: <CheckCircleOutlined />,
    denied: <CloseCircleOutlined />,
    escalated: <ExclamationCircleOutlined />,
    expired: <ClockCircleOutlined />,
};

const Index = () => {
    const { td } = useTd();
    const { t } = useTranslation();
    const [direction, setDirection] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [page, setPage] = useState(1);

    // Response modal state
    const [respondModal, setRespondModal] = useState<{
        open: boolean;
        action: "approve" | "deny" | null;
        request: AvailabilityRequest | null;
    }>({ open: false, action: null, request: null });
    const [responseMessage, setResponseMessage] = useState("");

    // Detail modal state
    const [detailModal, setDetailModal] = useState<{
        open: boolean;
        request: AvailabilityRequest | null;
    }>({ open: false, request: null });

    // Build query params
    const params: Record<string, string | number> = { page };
    if (direction !== "all") params.direction = direction;
    if (statusFilter) params.status = statusFilter;

    // Fetch requests
    const { data, isLoading, refetch } = useApiQuery<{
        data: PaginatedResponse;
    }>({
        path: route("availability-requests.index"),
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
            ? route("availability-requests.approve", respondModal.request.id)
            : "",
        "POST",
        () => {
            setRespondModal({ open: false, action: null, request: null });
            setResponseMessage("");
            refetch();
        },
    );

    // Deny mutation
    const { mutate: denyRequest, isPending: isDenying } = useApiMutate<
        { response_message?: string },
        any,
        ApiSuccessResponse<any>
    >(
        respondModal.request
            ? route("availability-requests.deny", respondModal.request.id)
            : "",
        "POST",
        () => {
            setRespondModal({ open: false, action: null, request: null });
            setResponseMessage("");
            refetch();
        },
    );

    const handleRespond = (
        request: AvailabilityRequest,
        action: "approve" | "deny",
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
            denyRequest(payload);
        }
    };

    const columns: TableColumnsType<AvailabilityRequest> = [
        {
            title: td("Property", { source: "en" }),
            key: "property",
            render: (_, record) => (
                <div>
                    <a
                        href={`/account/properties/${record.property?.id}`}
                        className="font-medium"
                    >
                        {(record.property &&
                            generatePropertySubtitle(record.property)) ||
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
            title: td("Requesting Agent", { source: "en" }),
            key: "requesting_agent",
            render: (_, record) => (
                <span>{record.requesting_agent?.name || "Unknown"}</span>
            ),
        },
        {
            title: td("Responsible Agent", { source: "en" }),
            key: "responsible_agent",
            render: (_, record) =>
                record.responsible_agent?.name ? (
                    <span>{record.responsible_agent.name}</span>
                ) : (
                    <span className="text-gray-400 italic">{td("Hidden", { source: "en" })}</span>
                ),
        },
        {
            title: td("Status", { source: "en" }),
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
            title: td("Message", { source: "en" }),
            key: "message",
            ellipsis: true,
            render: (_, record) => (
                <span className="text-gray-600">
                    {record.message || (
                        <span className="italic text-gray-400">{td("No message", { source: "en" })}</span>
                    )}
                </span>
            ),
        },
        {
            title: td("Requested", { source: "en" }),
            key: "created_at",
            width: 160,
            render: (_, record) => formatCompanyDateTime(record.created_at),
        },
        {
            title: td("Actions", { source: "en" }),
            key: "actions",
            width: 200,
            render: (_, record) => (
                <Space>
                    <Tooltip title={td("View details", { source: "en" })}>
                        <Button
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() =>
                                setDetailModal({ open: true, request: record })
                            }
                        />
                    </Tooltip>
                    {(record.status === "pending" ||
                        record.status === "escalated") && (
                        <>
                            <Button
                                size="small"
                                type="primary"
                                onClick={() => handleRespond(record, "approve")}
                            >
                                {td("Approve", { source: "en" })}
                            </Button>
                            <Button
                                size="small"
                                danger
                                onClick={() => handleRespond(record, "deny")}
                            >
                                {td("Deny", { source: "en" })}
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
                title={t("app.properties.actions.availability_requests")}
                breadcrumbs={[
                    {
                        name: t("app.menu.properties"),
                        url: route("properties.index"),
                    },
                    { name: t("app.properties.actions.availability_requests") },
                ]}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
                        <Segmented
                            options={[
                                { label: td("All", { source: "en" }), value: "all" },
                                { label: td("Sent by me", { source: "en" }), value: "sent" },
                                { label: td("Received", { source: "en" }), value: "received" },
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
                                    { label: td("All Statuses", { source: "en" }), value: "" },
                                    { label: td("Pending", { source: "en" }), value: "pending" },
                                    { label: td("Approved", { source: "en" }), value: "approved" },
                                    { label: td("Denied", { source: "en" }), value: "denied" },
                                    { label: td("Escalated", { source: "en" }), value: "escalated" },
                                ]}
                                value={statusFilter}
                                onChange={(val) => {
                                    setStatusFilter(val as string);
                                    setPage(1);
                                }}
                            />
                        </Space>
                    </div>

                    <DataTable
                        dataSource={requests}
                        columns={columns}
                        rowKey="id"
                        loading={isLoading}
                        paginationData={pagination ? {
                            current_page: pagination.current_page,
                            last_page: pagination.last_page,
                            per_page: pagination.per_page,
                            total: pagination.total,
                            from: null,
                            to: null,
                        } : null}
                        onPageChange={pagination ? (p) => setPage(p) : undefined}
                        emptyState={{ description: "No availability requests yet" }}
                        scroll={{ x: 1000, y: "calc(100vh - 320px)" }}
                    />
                </div>

                {/* Response Modal */}
                <Modal
                    title={
                        respondModal.action === "approve"
                            ? "Approve Availability Request"
                            : "Deny Availability Request"
                    }
                    open={respondModal.open}
                    onOk={handleSubmitResponse}
                    onCancel={() => {
                        if (!isApproving && !isDenying) {
                            setRespondModal({
                                open: false,
                                action: null,
                                request: null,
                            });
                            setResponseMessage("");
                        }
                    }}
                    confirmLoading={isApproving || isDenying}
                    okText={
                        respondModal.action === "approve" ? "Approve" : "Deny"
                    }
                    okButtonProps={{
                        danger: respondModal.action === "deny",
                    }}
                >
                    {respondModal.request && (
                        <div className="py-2">
                            <p className="mb-2">
                                <strong>{td("Property:", { source: "en" })}</strong>{" "}
                                {respondModal.request.property?.title}
                            </p>
                            <p className="mb-2 text-gray-500 text-sm">
                                <strong>{td("Ref:", { source: "en" })}</strong>{" "}
                                {respondModal.request.property?.reference_code}
                            </p>
                            <p className="mb-2">
                                <strong>{td("Requesting Agent:", { source: "en" })}</strong>{" "}
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
                                        ? "Optional response message"
                                        : "Optional reason for denial"
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
                    title={td("Request Details", { source: "en" })}
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
                                    {td("Property", { source: "en" })}
                                </span>
                                <div className="font-medium">
                                    {detailModal.request.property?.title}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {
                                        detailModal.request.property
                                            ?.reference_code
                                    }{" "}
                                    &bull; {detailModal.request.property?.city},{" "}
                                    {detailModal.request.property?.area}
                                </div>
                            </div>
                            <div>
                                <span className="text-gray-500 text-sm">
                                    {td("Requesting Agent", { source: "en" })}
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
                            {detailModal.request.responsible_agent && (
                                <div>
                                    <span className="text-gray-500 text-sm">
                                        {td("Responsible Agent", { source: "en" })}
                                    </span>
                                    <div>
                                        {
                                            detailModal.request
                                                .responsible_agent.name
                                        }
                                    </div>
                                </div>
                            )}
                            <div>
                                <span className="text-gray-500 text-sm">
                                    {td("Status", { source: "en" })}
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
                                        {td("Message", { source: "en" })}
                                    </span>
                                    <div>{detailModal.request.message}</div>
                                </div>
                            )}
                            {detailModal.request.response_message && (
                                <div>
                                    <span className="text-gray-500 text-sm">
                                        {td("Response", { source: "en" })}
                                    </span>
                                    <div>
                                        {detailModal.request.response_message}
                                    </div>
                                </div>
                            )}
                            <div>
                                <span className="text-gray-500 text-sm">
                                    {td("Requested At", { source: "en" })}
                                </span>
                                <div>
                                    {formatCompanyDateTime(
                                        detailModal.request.created_at,
                                    )}
                                </div>
                            </div>
                            {detailModal.request.responded_at && (
                                <div>
                                    <span className="text-gray-500 text-sm">
                                        {td("Responded At", { source: "en" })}
                                    </span>
                                    <div>
                                        {formatCompanyDateTime(
                                            detailModal.request.responded_at,
                                        )}
                                    </div>
                                </div>
                            )}
                            {detailModal.request.escalated_at && (
                                <div>
                                    <span className="text-gray-500 text-sm">
                                        {td("Escalated At", { source: "en" })}
                                    </span>
                                    <div>
                                        {formatCompanyDateTime(
                                            detailModal.request.escalated_at,
                                        )}
                                    </div>
                                </div>
                            )}
                            {detailModal.request.expires_at && (
                                <div>
                                    <span className="text-gray-500 text-sm">
                                        {td("Expires At", { source: "en" })}
                                    </span>
                                    <div>
                                        {formatCompanyDateTime(
                                            detailModal.request.expires_at,
                                        )}
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
