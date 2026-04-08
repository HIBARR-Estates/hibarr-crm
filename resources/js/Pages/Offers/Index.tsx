import { useMemo, useState } from "react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import OfferFormModal from "@/Features/Offers/OfferFormModal";
import DeleteOffer from "@/Features/Offers/DeleteOffer";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import type { Offer } from "@/Types/api/offers";
import type { Developer } from "@/Types/developerProject";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    EyeOutlined,
    ReloadOutlined,
} from "@ant-design/icons";
import { router } from "@inertiajs/react";
import { Button, Table, Tag, Select, Space } from "antd";
import type { TableColumnsType } from "antd";
import UniversalSearchBox from "@/Components/UniversalSearchBox";
import usePageRefresh from "@/Hooks/usePageRefresh";
import dayjs from "dayjs";
import OfferDetailDrawer from "@/Features/Offers/OfferDetailDrawer";

interface OffersIndexProps {
    pageTitle: string;
    offers: {
        data: Offer[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number | null;
        to: number | null;
    };
    developers: { id: number; name: string }[];
    filters: {
        search?: string;
        active_only?: string;
        developer_id?: string;
    };
}

const Index = ({
    pageTitle,
    offers,
    developers,
    filters,
}: OffersIndexProps) => {
    const {
        handleAction,
        handleClose,
        action,
        selected: offer,
    } = useGenericEntityAction<Offer>();

    const { refresh, isRefreshing } = usePageRefresh();
    const [activeFilter, setActiveFilter] = useState<string | undefined>(
        filters.active_only,
    );
    const [developerFilter, setDeveloperFilter] = useState<string | undefined>(
        filters.developer_id,
    );

    const applyFilter = (key: string, value: string | undefined) => {
        const params: Record<string, string | undefined> = {
            ...filters,
            [key]: value,
            page: undefined,
        };
        Object.keys(params).forEach(
            (k) => params[k] === undefined && delete params[k],
        );
        router.get(route("offers.index"), params, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const columns: TableColumnsType<Offer> = useMemo(
        () => [
            {
                title: "Name",
                dataIndex: "name",
                key: "name",
                width: 200,
                render: (name: string, record: Offer) => (
                    <a onClick={() => handleAction("view", record)}>{name}</a>
                ),
            },
            {
                title: "Developer",
                key: "developer",
                width: 150,
                render: (_, record) =>
                    record.developer?.name ?? (
                        <span className="text-gray-400">-</span>
                    ),
            },
            {
                title: "Type",
                dataIndex: "type",
                key: "type",
                width: 120,
                render: (type: string) => (
                    <Tag
                        color={
                            type === "percentage"
                                ? "blue"
                                : type === "perks"
                                  ? "purple"
                                  : "green"
                        }
                    >
                        {type === "percentage"
                            ? "Percentage"
                            : type === "perks"
                              ? "Perks"
                              : "Fixed"}
                    </Tag>
                ),
            },
            {
                title: "Value",
                key: "value",
                width: 120,
                align: "right",
                render: (_, record) =>
                    record.type === "perks"
                        ? "—"
                        : record.type === "percentage"
                          ? `${record.value}%`
                          : `${Number(record.value).toLocaleString("en-GB")}`,
            },
            {
                title: "Max Cap",
                dataIndex: "max_discount_amount",
                key: "max_discount_amount",
                width: 120,
                align: "right",
                render: (v: number | null) =>
                    v !== null ? Number(v).toLocaleString("en-GB") : "-",
            },
            {
                title: "Status",
                dataIndex: "is_active",
                key: "is_active",
                width: 90,
                align: "center",
                render: (active: boolean) => (
                    <Tag color={active ? "green" : "default"}>
                        {active ? "Active" : "Inactive"}
                    </Tag>
                ),
            },
            {
                title: "Applied",
                dataIndex: "deal_applications_count",
                key: "deal_applications_count",
                width: 80,
                align: "center",
                render: (count: number) => count || 0,
            },
            {
                title: "Date Range",
                key: "date_range",
                width: 200,
                render: (_, record) => {
                    if (!record.starts_at && !record.ends_at) return "-";
                    const start = record.starts_at
                        ? dayjs(record.starts_at).format("MMM DD, YYYY")
                        : "No start";
                    const end = record.ends_at
                        ? dayjs(record.ends_at).format("MMM DD, YYYY")
                        : "No end";
                    return `${start} → ${end}`;
                },
            },
            {
                title: "Actions",
                key: "actions",
                width: 130,
                align: "center",
                render: (_, record) => (
                    <Space size="small">
                        <Button
                            type="text"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => handleAction("view", record)}
                        />
                        <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleAction("edit", record)}
                        />
                        {!((record.developer_projects_count ?? 0) > 0) && (
                            <Button
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => handleAction("delete", record)}
                            />
                        )}
                    </Space>
                ),
            },
        ],
        [handleAction],
    );

    return (
        <>
            <PageLayout
                title="Offers"
                breadcrumbs={[{ name: "Offers" }]}
                searchComp={
                    <UniversalSearchBox
                        placeholder="Search offers by name..."
                        className="w-full"
                    />
                }
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => handleAction("add")}
                            >
                                Create Offer
                            </Button>
                            <Button
                                icon={<ReloadOutlined spin={isRefreshing} />}
                                onClick={refresh}
                                disabled={isRefreshing}
                                type="text"
                            >
                                Refresh
                            </Button>
                        </div>

                        <div className="flex items-center gap-3">
                            <Select
                                placeholder="Developer"
                                value={developerFilter}
                                onChange={(v) => {
                                    setDeveloperFilter(v);
                                    applyFilter("developer_id", v);
                                }}
                                allowClear
                                style={{ width: 180 }}
                                size="small"
                                showSearch
                                filterOption={(input, option) =>
                                    (option?.label ?? "")
                                        .toString()
                                        .toLowerCase()
                                        .includes(input.toLowerCase())
                                }
                                options={developers.map((d) => ({
                                    label: d.name,
                                    value: String(d.id),
                                }))}
                            />
                            <Select
                                placeholder="Status"
                                value={activeFilter}
                                onChange={(v) => {
                                    setActiveFilter(v);
                                    applyFilter("active_only", v);
                                }}
                                allowClear
                                style={{ width: 130 }}
                                size="small"
                                options={[
                                    { label: "Active", value: "1" },
                                    { label: "All", value: "0" },
                                ]}
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200">
                        <Table
                            columns={columns}
                            dataSource={offers.data}
                            rowKey="id"
                            pagination={{
                                current: offers.current_page,
                                total: offers.total,
                                pageSize: offers.per_page,
                                showSizeChanger: false,
                                showTotal: (total, range) =>
                                    `${range[0]}-${range[1]} of ${total} entries`,
                                onChange: (page, pageSize) => {
                                    router.get(
                                        route("offers.index"),
                                        {
                                            ...filters,
                                            page,
                                            per_page: pageSize,
                                        },
                                        {
                                            preserveState: true,
                                            preserveScroll: true,
                                        },
                                    );
                                },
                            }}
                            scroll={{ x: 1000 }}
                            size="small"
                        />
                    </div>
                </div>
            </PageLayout>

            <OfferFormModal
                open={["add", "edit"].includes(action ?? "")}
                onClose={handleClose}
                offer={action === "edit" ? offer : null}
            />

            <OfferDetailDrawer
                open={action === "view"}
                onClose={handleClose}
                offerId={offer?.id ?? null}
                onEdit={(o: Offer) => handleAction("edit", o)}
            />

            <DeleteOffer
                open={action === "delete"}
                onClose={() => handleClose()}
                offer={action === "delete" ? (offer ?? undefined) : undefined}
            />
        </>
    );
};

Index.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Index;
