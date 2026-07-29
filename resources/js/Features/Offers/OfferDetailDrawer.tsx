import React, { useState } from "react";
import {
    Drawer,
    Descriptions,
    Tag,
    Button,
    Space,
    Empty,
    Typography,
    Divider,
    Spin,
    Select,
    App,
    Switch,
} from "antd";
import { DataTable } from "@/Components/DataTable";
import type { TableColumnsType } from "antd";
import { GiftOutlined, LinkOutlined, EditOutlined } from "@ant-design/icons";
import { useApiQuery } from "@/lib/api/client";
import type { Offer, OfferablePivot } from "@/Types/api/offers";
import type {
    DeveloperProject,
    DeveloperProjectUnitType,
} from "@/Types/developerProject";
import { formatCompanyDate } from "@/lib/companyDateTime";
import { generatePropertySubtitle } from "@/lib/utils";

const { Text } = Typography;

type UnitTypeWithPivot = DeveloperProjectUnitType & { pivot?: OfferablePivot };

const isOfferablePivotActive = (pivot?: OfferablePivot): boolean => {
    const raw = (pivot as any)?.is_active;

    if (raw === undefined || raw === null) {
        return true;
    }

    return raw === true || raw === 1 || raw === "1";
};

interface OfferDetailDrawerProps {
    open: boolean;
    onClose: () => void;
    offerId: number | null;
    onEdit?: (offer: Offer) => void;
}

interface OfferShowResponse {
    status: string;
    offer: Offer & {
        developer_projects?: (DeveloperProject & {
            unit_types?: DeveloperProjectUnitType[];
        })[];
        unit_types?: UnitTypeWithPivot[];
        deal_applications_count?: number;
    };
}

const OfferDetailDrawer: React.FC<OfferDetailDrawerProps> = ({
    open,
    onClose,
    offerId,
    onEdit,
}) => {
    const { data, isLoading } = useApiQuery<OfferShowResponse>({
        path: offerId ? route("offers.show", offerId) : "",
        options: { enabled: open && !!offerId },
    });

    const offer = data?.offer;

    // Group unit types by project for the summary table
    const projectRows = (offer?.developer_projects ?? []).map((project) => {
        const projectUnitTypes = (offer?.unit_types ?? []).filter(
            (ut) => ut.developer_project_id === project.id,
        );
        const activeCount = projectUnitTypes.filter((ut) =>
            isOfferablePivotActive(ut.pivot),
        ).length;
        return { project, unitTypes: projectUnitTypes, activeCount };
    });

    const unitTypeColumns: TableColumnsType<UnitTypeWithPivot> = [
        {
            title: "Unit Type",
            key: "label",
            render: (_, record) => generatePropertySubtitle(record) || "N/A",
        },
        {
            title: "Beds",
            dataIndex: "bedrooms",
            key: "bedrooms",
            width: 60,
            align: "center",
            render: (v: number | null) => v ?? "—",
        },
        {
            title: "Status",
            key: "status",
            width: 100,
            align: "center",
            render: (_, record) => {
                const active = isOfferablePivotActive(record.pivot);
                return (
                    <Tag color={active ? "green" : "default"}>
                        {active ? "Active" : "Disabled"}
                    </Tag>
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
            onClose={onClose}
            extra={
                offer && onEdit ? (
                    <Button
                        type="primary"
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
                    {/* ── Core details ── */}
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
                                    ? formatCompanyDate(offer.starts_at)
                                    : "No start"}{" "}
                                →{" "}
                                {offer.ends_at
                                    ? formatCompanyDate(offer.ends_at)
                                    : "No end"}
                            </Descriptions.Item>
                        )}
                        <Descriptions.Item label="Deal Applications">
                            {offer.deal_applications_count ?? 0}
                        </Descriptions.Item>
                        <Descriptions.Item label="Unit Types Active">
                            {
                                (offer.unit_types ?? []).filter((ut) =>
                                    isOfferablePivotActive(ut.pivot),
                                ).length
                            }{" "}
                            / {offer.unit_types?.length ?? 0}
                        </Descriptions.Item>
                    </Descriptions>

                    {/* ── Links ── */}
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

                    {/* ── Projects summary ── */}
                    <div>
                        <Text strong className="block mb-3">
                            Applied to Projects ({projectRows.length})
                        </Text>
                        {projectRows.length === 0 ? (
                            <Empty
                                description="No projects attached"
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                            />
                        ) : (
                            projectRows.map(
                                ({ project, unitTypes, activeCount }) => (
                                    <div
                                        key={project.id}
                                        className="border border-gray-200/50 rounded-lg mb-3 overflow-hidden"
                                    >
                                        <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 border-b border-gray-100">
                                            <span className="font-medium text-sm text-gray-800 flex-1">
                                                {project.name}
                                            </span>
                                            <Tag
                                                color={
                                                    activeCount > 0
                                                        ? "blue"
                                                        : "default"
                                                }
                                            >
                                                {activeCount} active unit type
                                                {activeCount !== 1 ? "s" : ""}
                                            </Tag>
                                        </div>
                                        {unitTypes.length > 0 && (
                                            <DataTable
                                                columns={unitTypeColumns}
                                                dataSource={unitTypes}
                                                rowKey="id"
                                                size="small"
                                                className="border-0"
                                                scroll={{ x: "max-content" }}
                                            />
                                        )}
                                    </div>
                                ),
                            )
                        )}
                    </div>

                    <div className="text-center">
                        {offer && onEdit && (
                            <Button
                                type="primary"
                                icon={<EditOutlined />}
                                onClick={() => onEdit(offer)}
                            >
                                Edit Offer &amp; Manage Unit Types
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </Drawer>
    );
};

export default OfferDetailDrawer;
