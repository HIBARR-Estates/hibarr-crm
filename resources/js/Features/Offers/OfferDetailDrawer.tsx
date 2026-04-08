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
    Spin,
    Switch,
    App,
} from "antd";
import type { TableColumnsType } from "antd";
import { GiftOutlined, LinkOutlined, EditOutlined } from "@ant-design/icons";
import { useApiQuery } from "@/lib/api/client";
import type { Offer, OfferablePivot } from "@/Types/api/offers";
import type {
    DeveloperProject,
    DeveloperProjectUnitType,
} from "@/Types/developerProject";
import dayjs from "dayjs";
import { generatePropertySubtitle } from "@/lib/utils";

const { Text } = Typography;

type ProjectWithPivot = DeveloperProject & { pivot?: OfferablePivot };
type UnitTypeWithPivot = DeveloperProjectUnitType & { pivot?: OfferablePivot };

interface OfferDetailDrawerProps {
    open: boolean;
    onClose: () => void;
    offerId: number | null;
    onEdit?: (offer: Offer) => void;
}

interface OfferShowResponse {
    status: string;

    offer: Offer & {
        developer_projects?: ProjectWithPivot[];
        unit_types?: UnitTypeWithPivot[];
        deal_applications_count?: number;
    };
}

const csrfHeaders = () => ({
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "X-CSRF-TOKEN":
        document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content") ?? "",
    Accept: "application/json",
});

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
    const [toggleLoading, setToggleLoading] = useState<string | null>(null);

    const { data, isLoading, refetch } = useApiQuery<OfferShowResponse>({
        path: offerId ? route("offers.show", offerId) : "",
        options: { enabled: open && !!offerId },
    });

    const offer = data?.offer;

    // Fetch projects belonging to this offer's developer for the attach dropdown
    const { data: projectsData } = useApiQuery<{
        status: string;
        projects: DeveloperProject[];
    }>({
        path: route("developer-projects.all"),
        options: {
            enabled:
                open &&
                attachType === "developer_project" &&
                !!offer?.developer_id,
        },
    });

    // Filter to only the offer's developer's projects
    const developerProjects = (projectsData?.projects ?? []).filter(
        (p) => p.developer_id === offer?.developer_id,
    );

    // Exclude already-attached projects
    const attachedProjectIds = new Set(
        (offer?.developer_projects ?? []).map((p) => p.id),
    );
    const selectableProjects = developerProjects.filter(
        (p) => !attachedProjectIds.has(p.id),
    );

    // Fetch unit types from the first attached project for the attach dropdown
    const firstAttachedProjectId = offer?.developer_projects?.[0]?.id;
    const { data: unitTypesData } = useApiQuery<{
        status: string;
        unit_types: DeveloperProjectUnitType[];
    }>({
        path: firstAttachedProjectId
            ? route("developer-projects.unit-types.index", {
                  projectId: firstAttachedProjectId,
              })
            : "",
        options: {
            enabled: open && !!firstAttachedProjectId,
        },
    });

    // Exclude already-attached unit types
    const attachedUnitTypeIds = new Set(
        (offer?.unit_types ?? []).map((ut) => ut.id),
    );
    const selectableUnitTypes = (unitTypesData?.unit_types ?? []).filter(
        (ut) => !attachedUnitTypeIds.has(ut.id),
    );

    const handleAttach = async () => {
        if (!offerId || !attachType || !attachId) return;
        setAttachLoading(true);
        try {
            const res = await fetch(route("offers.attach", offerId), {
                method: "POST",
                headers: csrfHeaders(),
                body: JSON.stringify({
                    offerable_type: attachType,
                    offerable_ids: [attachId],
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

    const handleToggle = async (
        type: "developer_project" | "unit_type",
        id: number,
        enable: boolean,
    ) => {
        if (!offerId) return;
        const key = `${type}-${id}`;
        setToggleLoading(key);
        try {
            const endpoint = enable
                ? route("offers.enable", offerId)
                : route("offers.disable", offerId);
            await fetch(endpoint, {
                method: "POST",
                headers: csrfHeaders(),
                body: JSON.stringify({
                    offerable_type: type,
                    offerable_id: id,
                }),
            });
            refetch();
        } catch {
            message.error("Failed to update status");
        } finally {
            setToggleLoading(null);
        }
    };

    const projectColumns: TableColumnsType<ProjectWithPivot> = [
        {
            title: "Project",
            dataIndex: "name",
            key: "name",
        },
        {
            title: "Status",
            key: "status",
            width: 100,
            align: "center",
            render: (_, record) => {
                const active = record.pivot?.is_active !== false;
                return (
                    <Tag color={active ? "green" : "default"}>
                        {active ? "Active" : "Disabled"}
                    </Tag>
                );
            },
        },
        {
            title: "",
            key: "action",
            width: 80,
            render: (_, record) => {
                const active = record.pivot?.is_active !== false;
                return (
                    <Switch
                        size="small"
                        checked={active}
                        loading={
                            toggleLoading === `developer_project-${record.id}`
                        }
                        onChange={(checked) =>
                            handleToggle(
                                "developer_project",
                                record.id,
                                checked,
                            )
                        }
                    />
                );
            },
        },
    ];

    const unitTypeColumns: TableColumnsType<UnitTypeWithPivot> = [
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
            title: "Status",
            key: "status",
            width: 100,
            align: "center",
            render: (_, record) => {
                const active = record.pivot?.is_active !== false;
                return (
                    <Tag color={active ? "green" : "default"}>
                        {active ? "Active" : "Disabled"}
                    </Tag>
                );
            },
        },
        {
            title: "",
            key: "action",
            width: 80,
            render: (_, record) => {
                const active = record.pivot?.is_active !== false;
                return (
                    <Switch
                        size="small"
                        checked={active}
                        loading={toggleLoading === `unit_type-${record.id}`}
                        onChange={(checked) =>
                            handleToggle("unit_type", record.id, checked)
                        }
                    />
                );
            },
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
                        {offer.developer && (
                            <Descriptions.Item label="Developer" span={2}>
                                {offer.developer.name}
                            </Descriptions.Item>
                        )}
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
                                        : offer.type === "perks"
                                          ? "purple"
                                          : "green"
                                }
                            >
                                {offer.type === "percentage"
                                    ? "Percentage"
                                    : offer.type === "perks"
                                      ? "Perks"
                                      : "Fixed"}
                            </Tag>
                        </Descriptions.Item>
                        {offer.type !== "perks" && (
                            <Descriptions.Item label="Value">
                                {offer.type === "percentage"
                                    ? `${offer.value}%`
                                    : Number(offer.value).toLocaleString(
                                          "en-GB",
                                      )}
                            </Descriptions.Item>
                        )}
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

                    {/* Links */}
                    {offer.links && offer.links.length > 0 && (
                        <div>
                            <Text strong className="block mb-2">
                                <LinkOutlined className="mr-1" />
                                Links
                            </Text>
                            <ul className="list-none p-0 m-0 space-y-1">
                                {offer.links.map((link, i) => (
                                    <li key={i}>
                                        <a
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                        >
                                            <LinkOutlined />
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

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
                                    options={selectableProjects.map(
                                        (p: DeveloperProject) => ({
                                            label: p.name,
                                            value: p.id,
                                        }),
                                    )}
                                    value={attachId}
                                    onChange={setAttachId}
                                />
                            )}
                            {attachType === "unit_type" && (
                                <Select
                                    className="flex-1"
                                    placeholder="Select unit type..."
                                    showSearch
                                    filterOption={(input, option: any) =>
                                        (option?.label ?? "")
                                            .toString()
                                            .toLowerCase()
                                            .includes(input.toLowerCase())
                                    }
                                    options={selectableUnitTypes.map(
                                        (ut: DeveloperProjectUnitType) => ({
                                            label: generatePropertySubtitle(ut),
                                            value: ut.id,
                                        }),
                                    )}
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
