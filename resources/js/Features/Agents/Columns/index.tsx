import { Link } from "@inertiajs/react";
import { Button, Dropdown, MenuProps, Tag, Tooltip } from "antd";
import { ColumnsType } from "antd/lib/table";
import { MoreOutlined, MailOutlined, PhoneOutlined } from "@ant-design/icons";
import { Agent } from "@/Types/api/agents";
import { formatCompanyDate } from "@/lib/companyDateTime";
import UserIndicator from "@/Components/UserIndicator";
import PageDataSorter from "@/Components/PageDataSorter";

export const AGENT_TABLE_COLUMNS = (
    actionItems?: (item: Agent) => MenuProps["items"],
): ColumnsType<Agent> => [
    {
        title: (
            <span className="flex items-center">
                Agent Name
                <PageDataSorter field="created_at" routeName="agents.index" />
            </span>
        ),
        dataIndex: "name",
        key: "name",
        width: 220,
        render: (_, record) => {
            if (!record.user) return <span className="text-gray-400">--</span>;
            return (
                <div className="flex items-center gap-2">
                    <UserIndicator
                        data={{
                            image_url: record.user.image_url,
                            name: record.user.name,
                        }}
                        size="sm"
                        maxNameLength={25}
                    />
                </div>
            );
        },
    },
    {
        title: "Contact Details",
        dataIndex: "contact",
        key: "contact",
        width: 220,
        render: (_, record) => {
            const email = record.user?.email;
            const mobile = record.user?.mobile_with_phone_code;

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
                            <span className="text-sm text-gray-900 truncate">
                                {mobile}
                            </span>
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
        title: "Category",
        dataIndex: "category",
        key: "category",
        width: 150,
        render: (_, record) => {
            if (!record.category)
                return <span className="text-gray-400">--</span>;
            return (
                <Tooltip title={record.category.category_name}>
                    <Tag className="truncate max-w-full">
                        {record.category.category_name}
                    </Tag>
                </Tooltip>
            );
        },
    },
    {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 100,
        render: (_, record) => (
            <Tag color={record.status === "enabled" ? "green" : "red"}>
                {record.status === "enabled" ? "Active" : "Disabled"}
            </Tag>
        ),
    },
    {
        title: "Deals",
        dataIndex: "deals_count",
        key: "deals_count",
        width: 80,
        render: (_, record) => (
            <span className="text-gray-900">{record.deals_count ?? 0}</span>
        ),
    },
    {
        title: (
            <span className="flex items-center">
                Created
                <PageDataSorter field="created_at" routeName="agents.index" />
            </span>
        ),
        key: "created_at",
        width: 120,
        render: (_, record) => {
            if (!record.created_at)
                return <span className="text-gray-400">--</span>;
            return (
                <span className="text-gray-900">
                    {formatCompanyDate(record.created_at)}
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
