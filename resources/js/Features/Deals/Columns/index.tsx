import { Link } from "@inertiajs/react";
import { Button, Dropdown, MenuProps, Tooltip } from "antd";
import { ColumnsType } from "antd/lib/table";
import {
    MoreOutlined,
    UserOutlined,
    MailOutlined,
    PhoneOutlined,
    LockOutlined,
} from "@ant-design/icons";
import { Deal } from "@/Types/api/deals";
import dayjs from "dayjs";
import PageDataSorter from "@/Components/PageDataSorter";
import UserIndicator from "@/Components/UserIndicator";
import AgentSelector from "@/Components/AgentSelector";
import { formatMobileForDisplay, formatCountryForDisplay } from "@/lib/utils";

interface DealColumnOptions {
    actionItems?: (item: Deal) => MenuProps["items"];
    onAgentChange?: (deal: Deal, agentId: number | null) => void;
    canEdit?: (deal: Deal) => boolean;
    t?: (key: string) => string;
    td?: (text: string | null | undefined) => string;
}

export const DEAL_TABLE_COLUMNS = (
    options: DealColumnOptions = {},
): ColumnsType<Deal> => {
    const {
        actionItems,
        onAgentChange,
        canEdit,
        t = (key) => key,
        td = (key) => key,
    } = options;

    return [
        {
            title: (
                <span className="flex items-center gap-1.5 text-xs text-gray-500 uppercase tracking-wide">
                    {t("pages.deals.table.columns.created")}
                    <PageDataSorter
                        field="created_at"
                        routeName="deals.index"
                    />
                </span>
            ),
            key: "created_at",
            width: 150,
            render: (_, record) => {
                if (!record.created_at)
                    return <span className="text-gray-400">--</span>;

                return (
                    <div className="flex flex-col text-sm">
                        <span className="text-gray-950 font-medium">
                            {dayjs(record.created_at).format(
                                "MMM DD, YYYY",
                            )}
                        </span>
                        <span className="text-gray-600">
                             {dayjs(record.created_at).format(
                                "HH:mm",
                            )}
                        </span>
                    </div>
                );
            },
        },
        {
            title: (
                <span className="flex items-center">
                    {t("pages.deals.table.columns.deal_name")}
                    <PageDataSorter field="name" routeName="deals.index" />
                </span>
            ),
            dataIndex: "name",
            key: "deal_name",
            width: 280,
            render: (_, record) => {
                const hasContact = !!record.contact;
                let displayName = hasContact ? record.contact.client_name : null;
                if (hasContact && record.contact.salutation) {
                    const sal = record.contact.salutation;
                    displayName = `${sal.charAt(0).toUpperCase() + sal.slice(1)} ${displayName}`;
                }
                const translatedName = displayName ? displayName : null;

                const email = record.contact?.client_email;
                const mobile = record.contact?.mobile ? formatMobileForDisplay(record.contact.mobile) : null;

                return (
                    <div className="flex flex-col space-y-1 py-1">
                        {/* 1. Deal Name (Bold Headline) */}
                        <Tooltip title={td(record.name)}>
                            <Link
                                href={route("deals.show", record.id)}
                                className="block text-base font-semibold text-gray-950 hover:text-blue-600 hover:underline transition-colors duration-200 truncate max-w-full"
                            >
                                {record.is_locked && (
                                    <LockOutlined className="text-amber-500 mr-1.5 text-sm" />
                                )}
                                {td(record.name)}
                            </Link>
                        </Tooltip>

                        {/* 2. Client & Contact Block (Muted/Grayed out secondary details) */}
                        <div className="flex flex-col text-sm text-gray-500 space-y-0.5 subtle-meta">
                            {hasContact ? (
                                <>
                                    {/* Client Name & Icon Indicator */}
                                    <div className="flex items-center space-x-1.5">
                                        {/* Simple circle icon acting as the avatar target from screenshot */}
                                        
                                        <Tooltip title={translatedName ?? undefined}>
                                            <Link
                                                href={route("lead-contact.show", record.contact.id)}
                                                className="text-gray-500 hover:text-blue-600 hover:underline truncate max-w-full capitalize"
                                            >
                                                {translatedName}
                                            </Link>
                                        </Tooltip>
                                        {record.contact.company_name && (
                                            <span className="text-gray-400 truncate max-w-full text-xs">
                                                ({record.contact.company_name})
                                            </span>
                                        )}
                                    </div>

                                    {/* Actionable Email and Phone links if present */}
                                    {(email || mobile) && (
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400 mt-0.5">
                                            {email && (
                                                <div className="flex items-center space-x-1">
                                                    <MailOutlined className="text-gray-400 text-[10px]" />
                                                    <Tooltip title={email}>
                                                        <a
                                                            href={`mailto:${email}`}
                                                            className="hover:text-blue-600 hover:underline truncate max-w-[180px]"
                                                        >
                                                            {email}
                                                        </a>
                                                    </Tooltip>
                                                </div>
                                            )}
                                            {mobile && (
                                                <div className="flex items-center space-x-1">
                                                    <PhoneOutlined className="text-gray-400 text-[10px]" />
                                                    <Tooltip title={mobile}>
                                                        <a
                                                            href={`tel:${mobile.replace(/[^\d+]/g, "")}`}
                                                            className="hover:text-blue-600 hover:underline truncate"
                                                        >
                                                            {mobile}
                                                        </a>
                                                    </Tooltip>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <span className="text-gray-400 text-xs italic">
                                    {t("pages.deals.table.no_lead_assigned")}
                                </span>
                            )}
                        </div>
                    </div>
                );
            },
        },
   
        {
            title: (
                <span className="flex items-center">
                    {t("pages.deals.table.columns.lead_source")}
                </span>
            ),
            dataIndex: "lead_source",
            key: "lead_source",
            width: 120,
            render: (_, record) => {
                if (!record.contact?.lead_source)
                    return <span className="text-gray-400">--</span>;

                return (
                    <div className="font-medium text-gray-900">
                        {td(record.contact.lead_source.type)}
                    </div>
                );
            },
        },
     
        {
            title: t("pages.deals.table.columns.stage"),
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
                                {td(record.lead_stage.name)}
                            </span>
                        </Tooltip>
                    </div>
                );
            },
        },
        {
            title: (
                <span className="flex items-center">
                    {t("pages.deals.table.columns.deal_value")}
                    <PageDataSorter field="value" routeName="deals.index" />
                </span>
            ),
            dataIndex: "value",
            key: "value",
            width: 130,
            render: (_, record) => {
                if (!record.value)
                    return <span className="text-gray-400">--</span>;

                const symbol = record.currency?.currency_symbol || "£";

                return (
                    <span className="text-gray-900 font-medium">
                        {symbol}
                        {record.value.toLocaleString()}
                    </span>
                );
            },
        },
        {
            title: t("pages.deals.table.columns.assigned_agent"),
            dataIndex: "agent_name",
            key: "agent_name",
            width: 180,
            render: (_, deal) => {
                const isEditable = canEdit ? canEdit(deal) : true;
                const hasAgent = !!deal?.lead_agent?.user;

                // Prepare current agent for AgentSelector
                const currentAgent = hasAgent
                    ? {
                          id: deal.lead_agent!.user!.id,
                          name: deal.lead_agent!.user!.name,
                          image_url: deal.lead_agent!.user!.image_url,
                      }
                    : null;

                if (!isEditable || !onAgentChange) {
                    // Read-only view
                    if (!hasAgent) {
                        return <span className="text-gray-400">--</span>;
                    }
                    return (
                        <UserIndicator
                            data={deal.lead_agent!.user!}
                            size="sm"
                            maxNameLength={15}
                        />
                    );
                }

                // Interactive AgentSelector - fetches agents on-demand with search
                return (
                    <AgentSelector
                        currentAgent={currentAgent}
                        onSelect={(agentId) => onAgentChange(deal, agentId)}
                        size="default"
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
                    {t("pages.deals.table.columns.updated")}
                    <PageDataSorter
                        field="updated_at"
                        routeName="deals.index"
                    />
                </span>
            ),
            key: "updated_at",
            width: 150,
            render: (_, record) => {
                if (!record.updated_at)
                    return <span className="text-gray-400">--</span>;

                return (
                    <div className="flex flex-col text-sm">
                        <span className="text-gray-950 font-medium">
                            {dayjs(record.updated_at).format(
                                "MMM DD, YYYY",
                            )}
                        </span>
                        <span className="text-gray-600">
                             {dayjs(record.updated_at).format(
                                "HH:mm",
                            )}
                        </span>
                    </div>
                );
            },
        },
        

        {
            title: t("pages.deals.table.columns.actions"),
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
};
