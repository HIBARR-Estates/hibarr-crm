import { Link } from "@inertiajs/react";
import { Button, Dropdown, MenuProps, Tag, Tooltip, Avatar } from "antd";
import { ColumnsType } from "antd/lib/table";
import {
    MoreOutlined,
    UserOutlined,
    MailOutlined,
    PhoneOutlined,
} from "@ant-design/icons";
import { Lead } from "@/Types/api/leads";
import dayjs from "dayjs";
import UserIndicator from "@/Components/UserIndicator";
import PageDataSorter from "@/Components/PageDataSorter";

export const LEAD_TABLE_COLUMNS = (
    actionItems?: (item: Lead) => MenuProps["items"]
): ColumnsType<Lead> => [
    {
        title: (
            <span className="flex items-center">
                Contact Name
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
            <div className="space-y-1">
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
        title: "Contact Details",
        dataIndex: "contact_details",
        key: "contact_details",
        width: 200,
        render: (_, record) => {
            const email = record.client_email;
            let mobile = record.mobile;

            // Handle mobile JSON format
            if (mobile && typeof mobile === "string") {
                const mobileStr = mobile.trim();
                if (mobileStr.startsWith("{")) {
                    try {
                        const mobileData = JSON.parse(mobileStr);
                        if (mobileData && mobileData.phone) {
                            mobile = mobileData.phone;
                        }
                    } catch (e) {
                        // If JSON parsing fails, use the original string
                    }
                }
            }

            return (
                <div className="space-y-1">
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
                                        ""
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
        title: "Source",
        dataIndex: "source",
        key: "source",
        width: 120,
        render: (_, record) => {
            if (!record.leadSource)
                return <span className="text-gray-400">--</span>;

            return (
                <Tooltip title={record.leadSource.type}>
                    <Tag className="truncate max-w-full">
                        {record.leadSource.type}
                    </Tag>
                </Tooltip>
            );
        },
    },
    {
        title: (
            <span className="flex items-center">
                Lead Owner
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

    {
        title: "Category",
        dataIndex: "category",
        key: "category",
        width: 120,
        render: (_, record) => {
            if (!record.category)
                return <span className="text-gray-400">--</span>;

            return (
                <Tooltip title={record.category.category_name}>
                    <Tag color="blue" className="truncate max-w-full">
                        {record.category.category_name}
                    </Tag>
                </Tooltip>
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
                Created
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
        title: "Actions",
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
