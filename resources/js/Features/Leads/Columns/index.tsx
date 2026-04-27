import { Link } from "@inertiajs/react";
import { Button, Dropdown, MenuProps, Tag, Tooltip } from "antd";
import { ColumnsType } from "antd/lib/table";
import { MoreOutlined, MailOutlined, PhoneOutlined } from "@ant-design/icons";
import { Lead } from "@/Types/api/leads";
import dayjs from "dayjs";
import UserIndicator from "@/Components/UserIndicator";
import PageDataSorter from "@/Components/PageDataSorter";
import { formatMobileForDisplay, formatCountryForDisplay } from "@/lib/utils";

export const LEAD_TABLE_COLUMNS = (
    actionItems?: (item: Lead) => MenuProps["items"],
    t: (key: string) => string = (key) => key,
): ColumnsType<Lead> => [
    {
        title: (
            <span className="flex items-center">
                {t("pages.leads.contacts_table.columns.lead_name")}
                <PageDataSorter
                    field="client_name"
                    routeName="lead-contact.index"
                />
            </span>
        ),
        dataIndex: "name",
        key: "name",
        width: 250,
        render: (_, record) => (
            <div className="flex flex-col gap-y-1">
                <div>
                    <Tooltip title={record.client_name}>
                        <Link
                            href={route("lead-contact.show", record.id)}
                            className="block text-gray-900 hover:text-blue-600 hover:underline transition-colors duration-200 truncate font-medium max-w-full"
                        >
                            {record.client_name}
                        </Link>
                    </Tooltip>
                </div>
                {record.company_name && (
                    <Tooltip title={record.company_name}>
                        <div className="text-xs text-gray-500 truncate max-w-full">
                            {record.company_name}
                        </div>
                    </Tooltip>
                )}
            </div>
        ),
    },
    {
        title: t("pages.leads.contacts_table.columns.contact_details"),
        dataIndex: "contact_details",
        key: "contact_details",
        width: 200,
        render: (_, record) => {
            const email = record.client_email;
            const mobile = formatMobileForDisplay(record.mobile);

            return (
                <div className="flex flex-col gap-y-1">
                    {email && (
                        <div className="flex items-center space-x-2">
                            <MailOutlined className="text-gray-400 text-xs" />
                            <Tooltip title={email}>
                                <a
                                    href={`mailto:${email}`}
                                    className="text-gray-900 hover:text-blue-600 hover:underline transition-colors duration-200 truncate max-w-full block text-sm"
                                >
                                    {email}
                                </a>
                            </Tooltip>
                        </div>
                    )}
                    {mobile && (
                        <div className="flex items-center space-x-2">
                            <PhoneOutlined className="text-gray-400 text-xs" />
                            <Tooltip title={mobile}>
                                <a
                                    href={`tel:${mobile.replace(
                                        /[^\d+]/g,
                                        "",
                                    )}`}
                                    className="text-gray-900 hover:text-blue-600 hover:underline transition-colors duration-200 truncate max-w-full block text-sm"
                                >
                                    {mobile}
                                </a>
                            </Tooltip>
                        </div>
                    )}
                    {!email && !mobile && (
                        <span className="text-gray-400">--</span>
                    )}
                </div>
            );
        },
    },

    {
        title: t("pages.leads.contacts_table.columns.country"),
        dataIndex: "country",
        key: "country",
        width: 120,
        render: (_, record) => {
            const str = formatCountryForDisplay(record.country);
            return str ? (
                <span className="text-gray-900 truncate max-w-full block text-sm">
                    {str}
                </span>
            ) : (
                <span className="text-gray-400">--</span>
            );
        },
    },
    {
        title: t("pages.leads.contacts_table.columns.source"),
        dataIndex: "source",
        key: "source",
        width: 120,
        render: (_, record) => {
            if (!record.lead_source)
                return <span className="text-gray-400">--</span>;

            return (
                <Tooltip title={record.lead_source.type}>
                    <Tag className="truncate max-w-full">
                        {record.lead_source.type}
                    </Tag>
                </Tooltip>
            );
        },
    },
    {
        title: (
            <span className="flex items-center">
                {t("pages.leads.contacts_table.columns.lead_owner")}
                <PageDataSorter
                    field="lead_owner"
                    routeName="lead-contact.index"
                />
            </span>
        ),
        dataIndex: "lead_owner",
        key: "lead_owner",
        width: 150,
        render: (_, record) => {
            if (!record.lead_owner)
                return <span className="text-gray-400">--</span>;

            return (
                <UserIndicator
                    data={{
                        image_url: record.lead_owner.image_url,
                        name: record.lead_owner.name,
                    }}
                    size="sm"
                    maxNameLength={15}
                />
            );
        },
    },
    // {
    //     title: "Added By",
    //     dataIndex: "added_by",
    //     key: "added_by",
    //     width: 150,
    //     render: (_, record) => {
    //         if (!record.added_by)
    //             return <span className="text-gray-400">--</span>;

    //         return (
    //             <div className="flex items-center space-x-2">
    //                 <Avatar
    //                     size="small"
    //                     src={record.added_by.image_url}
    //                     icon={<UserOutlined />}
    //                     className="flex-shrink-0"
    //                 />
    //                 <Tooltip title={record.added_by.name}>
    //                     <span className="text-sm text-gray-900 truncate max-w-full">
    //                         {record.added_by.name}
    //                     </span>
    //                 </Tooltip>
    //             </div>
    //         );
    //     },
    // },
    {
        title: (
            <span className="flex items-center">
                {t("pages.leads.contacts_table.columns.created")}
                <PageDataSorter
                    field="created_at"
                    routeName="lead-contact.index"
                />
            </span>
        ),
        key: "created_at",
        width: 120,
        render: (_, record) => {
            if (!record.created_at)
                return <span className="text-gray-400">--</span>;

            return (
                <span className="text-gray-900">
                    {dayjs(record.created_at).format("MMM DD, YYYY")}
                </span>
            );
        },
    },

    {
        title: t("pages.leads.contacts_table.columns.actions"),
        key: "actions",
        width: 80,
        fixed: "right",
        render: (_, record) => (
            <Dropdown
                menu={{ items: actionItems?.(record) }}
                trigger={["click"]}
                placement="bottomRight"
            >
                <Button type="text" icon={<MoreOutlined />} />
            </Dropdown>
        ),
    },
];
