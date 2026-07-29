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
    EyeOutlined,
} from "@ant-design/icons";
import { DataTable } from "@/Components/DataTable";
import { useApiQuery } from "@/lib/api/client";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import type { ApiSuccessResponse } from "@/lib/api/types";
import { generatePropertySubtitle } from "@/lib/utils";
import { formatCompanyDateTime } from "@/lib/companyDateTime";

interface EditAccessRequest {
    id: number;
    property_id: number;
    requesting_agent_id: number;
    responsible_agent_id?: number;
    status: "pending" | "approved" | "denied";
    message: string | null;
    response_message: string | null;
    reviewed_at: string | null;
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
        display_title?: string;
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
    data: EditAccessRequest[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

const statusColors: Record<string, string> = {
    pending: "orange",
    approved: "green",
    denied: "red",
};

const statusIcons: Record<string, React.ReactNode> = {
    pending: <ClockCircleOutlined />,
    approved: <CheckCircleOutlined />,
    denied: <CloseCircleOutlined />,
};

const Index = () => {
    const { t } = useTranslation();
    const [direction, setDirection] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [page, setPage] = useState(1);

    const [respondModal, setRespondModal] = useState<{
        open: boolean;
        action: "approve" | "deny" | null;
        request: EditAccessRequest | null;
    }>({ open: false, action: null, request: null });
    const [responseMessage, setResponseMessage] = useState("");

    const [detailModal, setDetailModal] = useState<{
        open: boolean;
        request: EditAccessRequest | null;
    }>({ open: false, request: null });

    const params: Record<string, string | number> = { page };
    if (direction !== "all") params.direction = direction;
    if (statusFilter) params.status = statusFilter;

    const { data, isLoading, refetch } = useApiQuery<{
        data: PaginatedResponse;
    }>({
        path: route("edit-access-requests.index"),
        params,
    });

    const requests = data?.data?.data ?? [];
    const pagination = data?.data;

    const { mutate: approveRequest, isPending: isApproving } = useApiMutate<
        { response_message?: string },
        any,
        ApiSuccessResponse<any>
    >(
        respondModal.request
            ? route("edit-access-requests.approve", respondModal.request.id)
            : "",
        "POST",
        () => {
            setRespondModal({ open: false, action: null, request: null });
            setResponseMessage("");
            refetch();
        },
    );

    const { mutate: denyRequest, isPending: isDenying } = useApiMutate<
        { response_message?: string },
        any,
        ApiSuccessResponse<any>
    >(
        respondModal.request
            ? route("edit-access-requests.deny", respondModal.request.id)
            : "",
        "POST",
        () => {
            setRespondModal({ open: false, action: null, request: null });
            setResponseMessage("");
            refetch();
        },
    );

    const handleRespond = (
        request: EditAccessRequest,
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

    const columns: TableColumnsType<EditAccessRequest> = [
        {
            title: "Property",
            key: "property",
            render: (_, record) => (
                <div>
                    <a
                        href={`/account/properties/${record.property?.id}`}
                        className="font-medium"
                    >
                        {(record.property &&
                            generatePropertySubtitle(record.property)) ||
                            record.property?.display_title ||
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
            title: "Responsible Agent",
            key: "responsible_agent",
            render: (_, record) =>
                record.responsible_agent?.name ? (
                    <span>{record.responsible_agent.name}</span>
                ) : (
                    <span className="text-gray-400 italic">Hidden</span>
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
            title: "Requested",
            key: "created_at",
            width: 160,
            render: (_, record) => formatCompanyDateTime(record.created_at),
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
                    {record.status === "pending" && (
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
                                onClick={() => handleRespond(record, "deny")}
                            >
                                Deny
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
                title={t("app.properties.actions.edit_access_requests")}
                breadcrumbs={[
                    {
                        name: t("app.menu.properties"),
                        url: route("properties.index"),
                    },
                    { name: t("app.properties.actions.edit_access_requests") },
                ]}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
                        <Segmented
                            options={[
                                { label: "All", value: "all" },
                                { label: "Sent by me", value: "sent" },
                                { label: "Received", value: "received" },
                            ]}
                            value={direction}
                            onChange={(val) => {
                                setDirection(val as string);
                                setPage(1);
                            }}
                        />
                        <Segmented
                            options={[
                                { label: "All Statuses", value: "" },
                                { label: "Pending", value: "pending" },
                                { label: "Approved", value: "approved" },
                                { label: "Denied", value: "denied" },
                            ]}
                            value={statusFilter}
                            onChange={(val) => {
                                setStatusFilter(val as string);
                                setPage(1);
                            }}
                        />
                    </div>

                    <DataTable
                        dataSource={requests}
                        columns={columns}
                        rowKey="id"
                        loading={isLoading}
                        paginationData={
                            pagination
                                ? {
                                      current_page: pagination.current_page,
                                      last_page: pagination.last_page,
                                      per_page: pagination.per_page,
                                      total: pagination.total,
                                      from: null,
                                      to: null,
                                  }
                                : null
                        }
                        onPageChange={pagination ? (p) => setPage(p) : undefined}
                        emptyState={{
                            description: "No edit access requests yet",
                        }}
                        scroll={{ x: 1000, y: "calc(100vh - 320px)" }}
                    />
                </div>

                <Modal
                    title={
                        respondModal.action === "approve"
                            ? "Approve Edit Access Request"
                            : "Deny Edit Access Request"
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
                            <p className="mb-3 text-sm text-gray-500">
                                Approving grants collaborator access to edit
                                public listing fields and manage assets.
                            </p>
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

                <Modal
                    title="Edit Access Request Details"
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
                                    {detailModal.request.property?.display_title ||
                                        detailModal.request.property?.title}
                                </div>
                            </div>
                            <div>
                                <span className="text-gray-500 text-sm">
                                    Requesting Agent
                                </span>
                                <div>
                                    {detailModal.request.requesting_agent?.name}
                                </div>
                            </div>
                            {detailModal.request.responsible_agent && (
                                <div>
                                    <span className="text-gray-500 text-sm">
                                        Responsible Agent
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
                                        Message
                                    </span>
                                    <div>{detailModal.request.message}</div>
                                </div>
                            )}
                            {detailModal.request.response_message && (
                                <div>
                                    <span className="text-gray-500 text-sm">
                                        Response
                                    </span>
                                    <div>
                                        {detailModal.request.response_message}
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
