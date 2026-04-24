import React from "react";
import useTranslation from "@/Hooks/useTranslation";
import { Lead } from "@/Types/api/leads";
import { Deal, PaginatedDealResponse } from "@/Types/api/deals";
import { Link, usePage } from "@inertiajs/react";
import {
    Table,
    Button,
    Dropdown,
    MenuProps,
    Tag,
    Avatar,
    Tooltip,
    Empty,
} from "antd";
import {
    MoreOutlined,
    UserOutlined,
    EyeOutlined,
    EditOutlined,
    DeleteOutlined,
    PlusOutlined,
    MailOutlined,
    PhoneOutlined,
} from "@ant-design/icons";
import { ColumnsType } from "antd/es/table";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import DealInformationGatheringForm from "@/Features/Deals/DealInformationGathering/DealInformationGatheringForm";
import DeleteDeal from "@/Features/Deals/DeleteDeal";
import dayjs from "dayjs";

interface Props {
    lead: Lead;
    deals: Deal[];
    permissions: Record<string, string>;
}

export default function LeadDealsTab({ lead, deals, permissions }: Props) {
    const { t } = useTranslation();
    const { props } = usePage();
    const user = props.auth.user;
    const {
        action,
        handleAction,
        handleClose,
        selected: deal,
    } = useGenericEntityAction<Deal>();

    const columns: ColumnsType<Deal> = [
        {
            title: t("pages.leads.deals.column_name"),
            dataIndex: "name",
            key: "name",
            width: "25%",
            render: (_, record) => (
                <div className="space-y-1">
                    <Tooltip title={record.name}>
                        <Link
                            href={route("deals.show", record.id)}
                            className="block text-gray-900 hover:text-blue-600 hover:underline transition-colors duration-200 truncate font-medium"
                        >
                            {record.name}
                        </Link>
                    </Tooltip>
                    {record.category?.category_name && (
                        <Tag color="blue" className="text-xs">
                            {record.category.category_name}
                        </Tag>
                    )}
                </div>
            ),
        },
        {
            title: t("pages.leads.deals.column_value"),
            dataIndex: "value",
            key: "value",
            width: "15%",
            render: (_, record) => {
                if (!record.value)
                    return <span className="text-gray-400">--</span>;

                const currencySymbol = record.currency?.currency_symbol || "£";
                const value = record.value;

                return (
                    <div className="font-medium text-gray-900">
                        {currencySymbol}
                        {value.toLocaleString()}
                    </div>
                );
            },
        },
        {
            title: t("pages.leads.deals.column_stage"),
            dataIndex: "stage",
            key: "stage",
            width: "20%",
            render: (_, record) => {
                if (!record.lead_stage)
                    return <span className="text-gray-400">--</span>;

                return (
                    <div className="flex items-center space-x-2">
                        <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                                backgroundColor:
                                    record.lead_stage.label_color || "#007bff",
                            }}
                        ></div>
                        <Tooltip title={record.lead_stage.name}>
                            <span className="text-sm text-gray-900 truncate">
                                {record.lead_stage.name}
                            </span>
                        </Tooltip>
                    </div>
                );
            },
        },
        {
            title: t("pages.leads.deals.column_agent"),
            dataIndex: "agent_name",
            key: "agent_name",
            width: "20%",
            render: (_, record) => {
                if (!record.lead_agent?.user)
                    return <span className="text-gray-400">--</span>;

                return (
                    <div className="flex items-center space-x-2">
                        <Avatar
                            size="small"
                            src={record.lead_agent.user.image_url}
                            icon={<UserOutlined />}
                            className="flex-shrink-0"
                        />
                        <Tooltip title={record.lead_agent.user.name}>
                            <span className="text-sm text-gray-900 truncate">
                                {record.lead_agent.user.name}
                            </span>
                        </Tooltip>
                    </div>
                );
            },
        },
        {
            title: t("pages.leads.deals.column_close_date"),
            dataIndex: "close_date",
            key: "close_date",
            width: "15%",
            render: (_, record) => {
                if (!record.close_date)
                    return <span className="text-gray-400">--</span>;

                return (
                    <span className="text-sm text-gray-900">
                        {dayjs(record.close_date).format("MMM DD, YYYY")}
                    </span>
                );
            },
        },
        {
            title: t("pages.leads.deals.column_actions"),
            key: "actions",
            width: "10%",
            render: (_, record) => {
                const canView =
                    permissions.view_deals === "all" ||
                    (permissions.view_deals === "added" &&
                        record.added_by === user?.id) ||
                    (permissions.view_deals === "owned" &&
                        record.lead_agent?.user?.id === user?.id) ||
                    (permissions.view_deals === "both" &&
                        (record.added_by === user?.id ||
                            record.lead_agent?.user?.id === user?.id));

                const canEdit =
                    permissions.edit_deals === "all" ||
                    (permissions.edit_deals === "added" &&
                        record.added_by === user?.id) ||
                    (permissions.edit_deals === "owned" &&
                        record.lead_agent?.user?.id === user?.id) ||
                    (permissions.edit_deals === "both" &&
                        (record.added_by === user?.id ||
                            record.lead_agent?.user?.id === user?.id));

                const canDelete =
                    permissions.delete_deals === "all" ||
                    (permissions.delete_deals === "added" &&
                        record.added_by === user?.id) ||
                    (permissions.delete_deals === "owned" &&
                        record.lead_agent?.user?.id === user?.id) ||
                    (permissions.delete_deals === "both" &&
                        (record.added_by === user?.id ||
                            record.lead_agent?.user?.id === user?.id));

                const menuItems: MenuProps["items"] = [
                    ...(canView
                        ? [
                              {
                                  key: "view",
                                  label: (
                                      <Link
                                          href={route("deals.show", record.id)}
                                      >
                                          <EyeOutlined className="mr-2" />
                                          {t("app.view")}
                                      </Link>
                                  ),
                              },
                          ]
                        : []),
                    ...(canEdit
                        ? [
                              {
                                  key: "edit",
                                  label: (
                                      <span>
                                          <EditOutlined className="mr-2" />
                                          {t("app.edit")}
                                      </span>
                                  ),
                                  onClick: () => handleAction("edit", record),
                              },
                          ]
                        : []),
                    ...(canDelete
                        ? [
                              {
                                  key: "delete",
                                  onClick: () => handleAction("delete", record),
                                  label: (
                                      <span className="text-red-600">
                                          <DeleteOutlined className="mr-2" />
                                          {t("app.delete")}
                                      </span>
                                  ),
                                  danger: true,
                              },
                          ]
                        : []),
                ];

                return menuItems.length > 0 ? (
                    <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
                        <Button
                            type="text"
                            icon={<MoreOutlined />}
                            size="small"
                        />
                    </Dropdown>
                ) : null;
            },
        },
    ];

    console.log(deals, "----------");

    return (
        <>
            {deals.length === 0 && (
                <div className="p-8">
                    <Empty
                        description={
                            <div className="text-center">
                                <p className="text-gray-500 mb-2">
                                    {t("pages.leads.deals.empty_message")}
                                </p>
                                {(permissions.add_deals === "all" ||
                                    permissions.add_deals === "added" ||
                                    permissions.add_deals === "both") && (
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={() => handleAction("add")}
                                    >
                                        {t("pages.leads.deals.create_first")}
                                    </Button>
                                )}
                            </div>
                        }
                    />
                </div>
            )}

            {deals.length > 0 && (
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-gray-900">
                            {t("pages.leads.deals.header")} ({deals.length})
                        </h3>
                        {(permissions.add_deals === "all" ||
                            permissions.add_deals === "added" ||
                            permissions.add_deals === "both") && (
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => handleAction("add")}
                            >
                                {t("pages.leads.deals.add_deal")}
                            </Button>
                        )}
                    </div>

                    <Table
                        columns={columns}
                        dataSource={deals}
                        rowKey="id"
                        pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total) => `${t("pages.leads.deals.total")} ${total} ${t("pages.leads.deals.items")}`,
                        }}
                        className="deals-table"
                        scroll={{ x: 800 }}
                    />
                </div>
            )}

            {/* Add/Edit Deal Modal */}
            <DealInformationGatheringForm
                open={action === "add" || action === "edit"}
                onClose={handleClose}
                deal={action === "edit" ? deal : null}
                lead={lead}
            />

            {/* Delete Deal Modal */}
            <DeleteDeal
                open={action === "delete"}
                onClose={() => handleClose()}
                deal={deal}
            />
        </>
    );
}
