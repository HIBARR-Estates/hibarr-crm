import { Link } from "@inertiajs/react";
import { Button, Dropdown, MenuProps, Tag, Avatar, Tooltip } from "antd";
import { ColumnsType } from "antd/lib/table";
import {
    MoreOutlined,
    UserOutlined,
    MailOutlined,
    PhoneOutlined,
} from "@ant-design/icons";
import { Deal } from "@/Types/api/deals";
import dayjs from "dayjs";
import PageDataSorter from "@/Components/PageDataSorter";
import UserIndicator from "@/Components/UserIndicator";

export const DEAL_TABLE_COLUMNS = (
    actionItems?: (item: Deal) => MenuProps["items"]
): ColumnsType<Deal> => [
    {
        title: (
            <span className="flex items-center">
                Deal & Lead
                <PageDataSorter field="name" routeName="deals.index" />
            </span>
        ),
        dataIndex: "name",
        key: "deal_lead",
        width: 280,
        render: (_, record) => {
            const hasContact = !!record.contact;
            const isClient =
                hasContact &&
                record.contact.client_id !== null &&
                record.contact.client_id !== 0;

            let displayName = hasContact ? record.contact.client_name : null;
            if (hasContact && record.contact.salutation) {
                displayName = `${record.contact.salutation} ${displayName}`;
            }

            return (
                <div className="space-y-2 max-w-full">
                    {/* Deal Name */}
                    <div>
                        <Tooltip title={record.name}>
                            <Link
                                href={route("deals.show", record.id)}
                                className="block text-gray-900 hover:text-blue-600 hover:underline transition-colors duration-200 truncate font-medium max-w-full"
                            >
                                {record.name}
                            </Link>
                        </Tooltip>
                    </div>

                    {/* Lead Name */}
                    <div className="space-y-1">
                        {hasContact ? (
                            <>
                                <div className="flex items-center space-x-2">
                                    <Tooltip title={displayName}>
                                        <Link
                                            href={route(
                                                "lead-contact.show",
                                                record.contact.id
                                            )}
                                            className="text-xs text-gray-500 truncate max-w-full"
                                        >
                                            {displayName}
                                        </Link>
                                    </Tooltip>
                                    {/* {isClient && (
                                        <Tag color="blue" className="text-xs">
                                            Client
                                        </Tag>
                                    )} */}
                                </div>
                                {record.contact.company_name && (
                                    <Tooltip
                                        title={record.contact.company_name}
                                    >
                                        <div className="text-xs text-gray-500 truncate max-w-full">
                                            {record.contact.company_name}
                                        </div>
                                    </Tooltip>
                                )}
                            </>
                        ) : (
                            <span className="text-gray-400 text-xs">
                                No lead assigned
                            </span>
                        )}
                    </div>
                </div>
            );
        },
    },
    {
        title: "Contact Details",
        dataIndex: "contact_details",
        key: "contact_details",
        width: 200,
        render: (_, record) => {
            if (!record.contact)
                return <span className="text-gray-400">--</span>;

            const email = record.contact.client_email;
            let mobile = record.contact.mobile;

            // Handle mobile JSON format like in DealsDataTable
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
        title: (
            <span className="flex items-center">
                Deal Value
                <PageDataSorter field="value" routeName="deals.index" />
            </span>
        ),
        dataIndex: "value",
        key: "value",
        width: 120,
        render: (_, record) => {
            if (!record.value) return <span className="text-gray-400">--</span>;

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
        title: "Stage",
        dataIndex: "stage",
        key: "stage",
        width: 150,
        render: (_, record) => {
            if (!record.lead_stage)
                return <span className="text-gray-400">--</span>;

            return (
                <div className="flex items-center space-x-2 max-w-full">
                    <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                            backgroundColor:
                                record.lead_stage.label_color || "#007bff",
                        }}
                    ></div>
                    <Tooltip title={record.lead_stage.name}>
                        <span className="text-sm text-gray-900 truncate max-w-full">
                            {record.lead_stage.name}
                        </span>
                    </Tooltip>
                </div>
            );
        },
    },

    {
        title: (
            <span className="flex items-center">
                Next Meeting
                <PageDataSorter
                    field="next_follow_up_date"
                    routeName="deals.index"
                />
            </span>
        ),
        dataIndex: "next_follow_up_date",
        key: "next_follow_up_date",
        width: 150,
        render: (_, record) => {
            if (!record.next_follow_up_date)
                return <span className="text-gray-400">--</span>;

            const currentDate = dayjs();
            const followUpDate = dayjs(record.next_follow_up_date);
            const isPending =
                record.next_follow_up_status === "incomplete" &&
                followUpDate.isBefore(currentDate, "day");

            return (
                <div className="space-y-1">
                    <div className="text-gray-900">
                        {followUpDate.format("MMM DD, YYYY")}
                    </div>
                    {isPending && (
                        <Tag color="red" className="text-xs">
                            Pending
                        </Tag>
                    )}
                </div>
            );
        },
    },
    {
        title: "Deal Agent",
        dataIndex: "agent_name",
        key: "agent_name",
        width: 150,
        render: (_, deal) => {
            if (!deal?.lead_agent?.user)
                return <span className="text-gray-400">--</span>;

            return (
                <UserIndicator
                    data={deal.lead_agent.user}
                    size="sm"
                    maxNameLength={15}
                />
            );
        },
    },
    // {
    //     title: "Deal Watchers",
    //     dataIndex: "deal_watchers",
    //     key: "deal_watchers",
    //     width: 180,
    //     render: (_, record) => {
    //         if (!record.deal_watchers || record.deal_watchers.length === 0)
    //             return <span className="text-gray-400">--</span>;

    //         const displayWatchers = record.deal_watchers.slice(0, 2);
    //         const remainingCount = record.deal_watchers.length - 2;

    //         return (
    //             <div className="space-y-1">
    //                 {displayWatchers.map((watcher) => (
    //                     <div
    //                         key={watcher.id}
    //                         className="flex items-center space-x-2"
    //                     >
    //                         <Avatar
    //                             size="small"
    //                             src={watcher.image}
    //                             icon={<UserOutlined />}
    //                             className="flex-shrink-0"
    //                         />
    //                         <Tooltip title={watcher.name}>
    //                             <span className="text-sm text-gray-900 truncate max-w-full">
    //                                 {watcher.name}
    //                             </span>
    //                         </Tooltip>
    //                     </div>
    //                 ))}
    //                 {remainingCount > 0 && (
    //                     <div className="text-xs text-gray-500">
    //                         +{remainingCount} more
    //                     </div>
    //                 )}
    //             </div>
    //         );
    //     },
    // },

    // {
    //     title: "Close Date",
    //     dataIndex: "close_date",
    //     key: "close_date",
    //     width: 120,
    //     render: (_, record) => {
    //         if (!record.close_date)
    //             return <span className="text-gray-400">--</span>;

    //         return (
    //             <span className="text-gray-900">
    //                 {dayjs(record.close_date).format("MMM DD, YYYY")}
    //             </span>
    //         );
    //     },
    // },

    {
        title: (
            <span className="flex items-center">
                Created
                <PageDataSorter field="created_at" routeName="deals.index" />
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
