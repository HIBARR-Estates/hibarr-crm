import React, { useState } from "react";
import {
    Drawer,
    Descriptions,
    Tag,
    Table,
    Button,
    Select,
    Space,
    Empty,
    Typography,
    Divider,
    Popconfirm,
    Spin,
    App,
} from "antd";
import type { TableColumnsType } from "antd";
import {
    GiftOutlined,
    LinkOutlined,
    DisconnectOutlined,
    EditOutlined,
} from "@ant-design/icons";
import { useApiQuery } from "@/lib/api/client";
import type { Offer } from "@/Types/api/offers";
import type {
    DeveloperProject,
    DeveloperProjectUnitType,
} from "@/Types/developerProject";
import dayjs from "dayjs";

const { Text } = Typography;

interface OfferDetailDrawerProps {
    open: boolean;
    onClose: () => void;
    offerId: number | null;
    onEdit?: (offer: Offer) => void;
}

interface OfferShowResponse {
    status: string;
    data: {
        offer: Offer & {
            developer_projects?: DeveloperProject[];
            unit_types?: DeveloperProjectUnitType[];
            deal_applications_count?: number;
        };
    };
}

const OfferDetailDrawer: React.FC<OfferDetailDrawerProps> = ({
    open,
    onClose,
    offerId,
    onEdit,
}) => {
    const { message } = App.useApp();
    const [attachType, setAttachType] = useState<
        "developer_project" | "unit_type" | null
    >(null);
    const [attachId, setAttachId] = useState<number | null>(null);
    const [attachLoading, setAttachLoading] = useState(false);

    const { data, isLoading, refetch } = useApiQuery<OfferShowResponse>({
        path: offerId ? route("offers.show", offerId) : "",
        options: { enabled: open && !!offerId },
    });

    const offer = data?.data?.offer;

    // Fetch projects and unit types for the attach dropdown
    const { data: projectsData } = useApiQuery<{
        data: DeveloperProject[];
    }>({
        path: route("developer-projects.index"),
        params: { per_page: 200 },
        options: { enabled: open && attachType === "developer_project" },
    });

    const { data: unitTypesData } = useApiQuery<{
        data: { unit_types: DeveloperProjectUnitType[] };
    }>({
        path: route("developer-projects.index"),
        params: { per_page: 200, include_unit_types: true },
        options: { enabled: open && attachType === "unit_type" },
    });

    const handleAttach = async () => {
        if (!offerId || !attachType || !attachId) return;
        setAttachLoading(true);
        try {
            const res = await fetch(route("offers.attach", offerId), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                    "X-CSRF-TOKEN":
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute("content") ?? "",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    offerable_type: attachType,
                    offerable_id: attachId,
                }),
            });
            const result = await res.json();
            if (result.status === "success") {
                message.success("Offer attached");
                setAttachType(null);
                setAttachId(null);
                refetch();
            } else {
                message.error(result.message || "Failed to attach");
            }
        } finally {
            setAttachLoading(false);
        }
    };

    const handleDetach = async (
        type: "developer_project" | "unit_type",
        id: number,
    ) => {
        if (!offerId) return;
        try {
            await fetch(route("offers.detach", offerId), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                    "X-CSRF-TOKEN":
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute("content") ?? "",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    offerable_type: type,
                    offerable_id: id,
                }),
            });
            message.success("Offer detached");
            refetch();
        } catch {
            message.error("Failed to detach");
        }
    };

    const projectColumns: TableColumnsType<DeveloperProject> = [
        {
            title: "Project",
            dataIndex: "name",
            key: "name",
        },
        {
            title: "",
            key: "action",
            width: 80,
            render: (_, record) => (
                <Popconfirm
                    title="Detach from this project?"
                    onConfirm={() =>
                        handleDetach("developer_project", record.id)
                    }
                    okText="Detach"
                    okType="danger"
                >
                    <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DisconnectOutlined />}
                    />
                </Popconfirm>
            ),
        },
    ];

    const unitTypeColumns: TableColumnsType<DeveloperProjectUnitType> = [
        {
            title: "Unit Type",
            key: "label",
            render: (_, record) =>
                record.display_label ||
                `${record.primary_category} - ${record.property_type || "N/A"}`,
        },
        {
            title: "Beds",
            dataIndex: "bedrooms",
            key: "bedrooms",
            width: 60,
            render: (v: number | null) => v ?? "-",
        },
        {
            title: "",
            key: "action",
            width: 80,
            render: (_, record) => (
                <Popconfirm
                    title="Detach from this unit type?"
                    onConfirm={() => handleDetach("unit_type", record.id)}
                    okText="Detach"
                    okType="danger"
                >
                    <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DisconnectOutlined />}
                    />
                </Popconfirm>
            ),
        },
    ];

    return (
        <Drawer
            title={
                <Space>
                    <GiftOutlined />
                    {offer?.name || "Offer Details"}
                </Space>
            }
            placement="right"
            size="large"
            open={open}
            onClose={() => {
                setAttachType(null);
                setAttachId(null);
                onClose();
            }}
            extra={
                offer && onEdit ? (
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => onEdit(offer)}
                    >
                        Edit
                    </Button>
                ) : null
            }
        >
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Spin />
                </div>
            ) : !offer ? (
                <Empty description="Offer not found" />
            ) : (
                <div className="space-y-6">
                    {/* Offer Details */}
                    <Descriptions column={2} bordered size="small">
                        <Descriptions.Item label="Name" span={2}>
                            {offer.name}
                        </Descriptions.Item>
                        {offer.description && (
                            <Descriptions.Item label="Description" span={2}>
                                {offer.description}
                            </Descriptions.Item>
                        )}
                        <Descriptions.Item label="Type">
                            <Tag
                                color={
                                    offer.type === "percentage"
                                        ? "blue"
                                        : "green"
                                }
                            >
                                {offer.type === "percentage"
                                    ? "Percentage"
                                    : "Fixed"}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Value">
                            {offer.type === "percentage"
                                ? `${offer.value}%`
                                : Number(offer.value).toLocaleString("en-GB")}
                        </Descriptions.Item>
                        {offer.max_discount_amount && (
                            <Descriptions.Item label="Max Cap">
                                {Number(
                                    offer.max_discount_amount,
                                ).toLocaleString("en-GB")}
                            </Descriptions.Item>
                        )}
                        <Descriptions.Item label="Status">
                            <Tag color={offer.is_active ? "green" : "default"}>
                                {offer.is_active ? "Active" : "Inactive"}
                            </Tag>
                        </Descriptions.Item>
                        {(offer.starts_at || offer.ends_at) && (
                            <Descriptions.Item label="Date Range" span={2}>
                                {offer.starts_at
                                    ? dayjs(offer.starts_at).format(
                                          "MMM DD, YYYY",
                                      )
                                    : "No start"}{" "}
                                →{" "}
                                {offer.ends_at
                                    ? dayjs(offer.ends_at).format(
                                          "MMM DD, YYYY",
                                      )
                                    : "No end"}
                            </Descriptions.Item>
                        )}
                        <Descriptions.Item label="Deal Applications">
                            {offer.deal_applications_count ?? 0}
                        </Descriptions.Item>
                    </Descriptions>

                    <Divider />

                    {/* Attached Projects */}
                    <div>
                        <Text strong className="block mb-2">
                            Attached Projects (
                            {offer.developer_projects?.length ?? 0})
                        </Text>
                        {offer.developer_projects &&
                        offer.developer_projects.length > 0 ? (
                            <Table
                                columns={projectColumns}
                                dataSource={offer.developer_projects}
                                rowKey="id"
                                pagination={false}
                                size="small"
                            />
                        ) : (
                            <Empty
                                description="Not attached to any projects"
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                            />
                        )}
                    </div>

                    {/* Attached Unit Types */}
                    <div>
                        <Text strong className="block mb-2">
                            Attached Unit Types ({offer.unit_types?.length ?? 0}
                            )
                        </Text>
                        {offer.unit_types && offer.unit_types.length > 0 ? (
                            <Table
                                columns={unitTypeColumns}
                                dataSource={offer.unit_types}
                                rowKey="id"
                                pagination={false}
                                size="small"
                            />
                        ) : (
                            <Empty
                                description="Not attached to any unit types"
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                            />
                        )}
                    </div>

                    <Divider />

                    {/* Attach from here */}
                    <div>
                        <Text strong className="block mb-2">
                            <LinkOutlined className="mr-1" />
                            Attach to Project or Unit Type
                        </Text>
                        <div className="flex items-center gap-3">
                            <Select
                                placeholder="Select type..."
                                style={{ width: 180 }}
                                value={attachType}
                                onChange={(v) => {
                                    setAttachType(v);
                                    setAttachId(null);
                                }}
                                allowClear
                                options={[
                                    {
                                        label: "Developer Project",
                                        value: "developer_project",
                                    },
                                    {
                                        label: "Unit Type",
                                        value: "unit_type",
                                    },
                                ]}
                            />
                            {attachType === "developer_project" && (
                                <Select
                                    className="flex-1"
                                    placeholder="Select project..."
                                    showSearch
                                    filterOption={(input, option) =>
                                        (option?.label ?? "")
                                            .toString()
                                            .toLowerCase()
                                            .includes(input.toLowerCase())
                                    }
                                    options={(
                                        (projectsData as any)?.data ?? []
                                    ).map((p: DeveloperProject) => ({
                                        label: p.name,
                                        value: p.id,
                                    }))}
                                    value={attachId}
                                    onChange={setAttachId}
                                />
                            )}
                            {attachType === "unit_type" && (
                                <Select
                                    className="flex-1"
                                    placeholder="Select unit type..."
                                    showSearch
                                    filterOption={(input, option) =>
                                        (option?.label ?? "")
                                            .toString()
                                            .toLowerCase()
                                            .includes(input.toLowerCase())
                                    }
                                    options={(
                                        (unitTypesData as any)?.data
                                            ?.unit_types ?? []
                                    ).map((ut: DeveloperProjectUnitType) => ({
                                        label:
                                            ut.display_label ||
                                            `${ut.primary_category} - ${ut.property_type || "N/A"}`,
                                        value: ut.id,
                                    }))}
                                    value={attachId}
                                    onChange={setAttachId}
                                />
                            )}
                            {attachType && (
                                <Button
                                    type="primary"
                                    size="small"
                                    onClick={handleAttach}
                                    loading={attachLoading}
                                    disabled={!attachId}
                                >
                                    Attach
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Drawer>
    );
};

export default OfferDetailDrawer;
