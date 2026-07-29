import React from "react";
import { Deal } from "@/Types/api/deals";
import { Card, Dropdown, Button, Typography, Tooltip, Avatar } from "antd";
import type { MenuProps } from "antd";
import {
    EllipsisOutlined as MoreOutlined,
    CalendarOutlined,
    CheckSquareOutlined,
    VideoCameraOutlined,
    MessageOutlined,
    EditOutlined,
    EyeOutlined,
    UserOutlined,
    LockOutlined,
} from "@ant-design/icons";
import { Link } from "@inertiajs/react";
import dayjs from "dayjs";
import { formatCompanyDate, formatCompanyDateTime } from "@/lib/companyDateTime";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import AgentSelector from "../AgentSelector";

const { Text } = Typography;

interface DealCardProps {
    deal: Deal;
    draggable?: boolean;
    td?: (text: string | null | undefined) => string;
    onEdit?: (deal: Deal) => void;
    onScheduleMeeting?: (deal: Deal) => void;
    onAgentChange?: (deal: Deal, agentId: number | null) => void;
}

const DealCard: React.FC<DealCardProps> = ({
    deal,
    draggable = true,
    td = (text) => text ?? "",
    onEdit,
    onScheduleMeeting,
    onAgentChange,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: deal.id.toString(),
        disabled: !draggable || !!deal.is_locked,
    });

    // Get deal permissions to check if user can edit
    const { canEdit } = useDealPermissions(deal);
    const isLocked = !!deal.is_locked;

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    // Format currency
    const formattedValue = `${deal?.currency?.currency_symbol || "€"}${deal?.value?.toLocaleString() || "0"}`;

    // Format date
    const formattedDate = deal.created_at
        ? formatCompanyDate(deal.created_at)
        : null;

    // Prepare current agent for AgentSelector
    const currentAgent = deal.lead_agent?.user
        ? {
              id: deal.lead_agent.user.id,
              name: deal.lead_agent.user.name,
              image_url: deal.lead_agent.user.image_url,
          }
        : null;

    // Action items for dropdown - conditionally include edit based on permissions
    const actionItems: MenuProps["items"] = [
        // View deal - always available
        {
            key: "view",
            icon: <EyeOutlined />,
            label: <Link href={route("deals.show", deal.id)}>View Deal</Link>,
        },
        // Edit deal - only if user has edit permission (not for watchers)
        ...(canEdit
            ? [
                  {
                      key: "edit",
                      icon: <EditOutlined />,
                      label: "Edit Deal",
                      onClick: (e: any) => {
                          e.domEvent.stopPropagation();
                          e.domEvent.preventDefault();
                          onEdit?.(deal);
                      },
                  },
              ]
            : []),
        // Schedule Meeting - replaces Assign Agent (now available via inline agent selector)
        {
            key: "schedule_meeting",
            icon: <CalendarOutlined />,
            label: "Schedule Meeting",
            onClick: (e: any) => {
                e.domEvent.stopPropagation();
                e.domEvent.preventDefault();
                onScheduleMeeting?.(deal);
            },
        },
    ];

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`mb-2 mx-2 ${!draggable ? "move-disable" : ""} ${isDragging ? "z-50" : ""}`}
            data-task-id={deal.id}
            id={`drag-task-${deal.id}`}
        >
            <Card
                size="small"
                className={`
                    transition-all duration-150 cursor-pointer rounded-lg
                    ${isDragging ? "ring-1 ring-blue-400 rotate-1 opacity-60" : "hover:border-gray-300"}
                    ${isLocked ? "border-amber-300 opacity-80" : "border-gray-200"}
                    border
                `}
                styles={{
                    body: {
                        padding: "10px 12px",
                        backgroundColor: "#f3f4f545",
                    },
                }}
                style={{
                    backgroundColor: "#f3f4f545",
                }}
                variant="outlined"
            >
                {/* Header: Deal Name + Actions */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                        <Link
                            href={route("deals.show", deal.id)}
                            className="block"
                        >
                            <Text
                                strong
                                className="text-[15px] text-gray-800 leading-tight block hover:text-blue-600 transition-colors"
                                ellipsis={{ tooltip: td(deal.name) }}
                            >
                                {isLocked && (
                                    <LockOutlined className="text-amber-500 mr-1 text-[12px]" />
                                )}
                                <span className="font-medium">
                                    {td(deal.name)}
                                </span>
                                {deal.contact?.client_id && (
                                    <i
                                        className="fa fa-check-circle text-green-500 ml-1 text-[12px]"
                                        title="Converted Client"
                                    />
                                )}
                            </Text>
                        </Link>
                    </div>

                    <Dropdown
                        menu={{ items: actionItems }}
                        trigger={["click"]}
                        placement="bottomRight"
                    >
                        <Button
                            type="text"
                            icon={<MoreOutlined className="text-[14px]" />}
                            size="small"
                            className="text-gray-400 hover:text-gray-600 hover:bg-gray-50 -mr-1 -mt-0.5 flex-shrink-0 w-6 h-6 min-w-0 p-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                            }}
                        />
                    </Dropdown>
                </div>

                {/* Lead/Contact Name — icon-prefixed and labeled so it doesn't
                    read as a second deal title under deal.name above */}
                {deal.contact?.client_name && (
                    <div className="mb-2 flex items-center gap-1 min-w-0">
                        <UserOutlined className="text-gray-400 text-[11px] flex-shrink-0" />
                        <Text
                            className="text-[13px] text-gray-500 leading-tight"
                            ellipsis={{
                                tooltip: `Contact: ${deal.contact.salutation ? (deal.contact.salutation.charAt(0).toUpperCase() + deal.contact.salutation.slice(1)) + " " : ""}${td(deal.contact.client_name)}`,
                            }}
                        >
                            {deal.contact.salutation &&
                                `${deal.contact.salutation.charAt(0).toUpperCase() + deal.contact.salutation.slice(1)} `}
                            {deal.contact.client_name}
                        </Text>
                    </div>
                )}

                {/* Agent + Deal Value Row */}
                <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="flex-1 min-w-0">
                        {canEdit && onAgentChange ? (
                            // Interactive agent selector using useFormData
                            <AgentSelector
                                currentAgent={currentAgent}
                                onSelect={(agentId) =>
                                    onAgentChange(deal, agentId)
                                }
                                size="small"
                            />
                        ) : // Read-only agent display
                        currentAgent ? (
                            <div className="flex items-center gap-1.5">
                                <Avatar
                                    size={20}
                                    src={currentAgent.image_url}
                                    icon={<UserOutlined />}
                                />
                                <Tooltip title={currentAgent.name}>
                                    <Text
                                        className="text-[13px] text-gray-600 truncate max-w-[80px]"
                                        ellipsis
                                    >
                                        {currentAgent.name}
                                    </Text>
                                </Tooltip>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                                    <UserOutlined className="text-gray-400 text-[10px]" />
                                </div>
                                <Text className="text-[13px] text-gray-400">
                                    Unassigned
                                </Text>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center">
                        <Text strong className="text-[15px] text-gray-800">
                            {formattedValue}
                        </Text>
                    </div>
                </div>

                {/* Footer: Date + Stats */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    {/* Date Created */}
                    <div className="flex items-center">
                        {formattedDate ? (
                            <Tooltip
                                title={
                                    deal.updated_at
                                        ? `Created: ${formatCompanyDateTime(deal.created_at)} · Updated: ${formatCompanyDateTime(deal.updated_at)}`
                                        : `Created: ${formatCompanyDateTime(deal.created_at)}`
                                }
                            >
                                <div className="flex items-center gap-1 text-[12px] text-gray-400">
                                    <CalendarOutlined className="text-[12px]" />
                                    <span>{formattedDate}</span>
                                </div>
                            </Tooltip>
                        ) : (
                            <span className="text-[12px] text-gray-300">
                                No date
                            </span>
                        )}
                    </div>

                    {/* Stats: Tasks, Meetings, Activities */}
                    <div className="flex items-center gap-2.5">
                        {(deal.tasks_count ?? 0) > 0 && (
                            <Tooltip title={`${deal.tasks_count} Tasks`}>
                                <div className="flex items-center gap-1 text-[12px] text-gray-400">
                                    <CheckSquareOutlined className="text-[12px]" />
                                    <span>{deal.tasks_count}</span>
                                </div>
                            </Tooltip>
                        )}

                        {(deal.meetings_count ?? 0) > 0 && (
                            <Tooltip title={`${deal.meetings_count} Meetings`}>
                                <div className="flex items-center gap-1 text-[12px] text-gray-400">
                                    <VideoCameraOutlined className="text-[12px]" />
                                    <span>{deal.meetings_count}</span>
                                </div>
                            </Tooltip>
                        )}

                        {(deal.activities_count ?? 0) > 0 && (
                            <Tooltip
                                title={`${deal.activities_count} Activities`}
                            >
                                <div className="flex items-center gap-1 text-[12px] text-gray-400">
                                    <MessageOutlined className="text-[12px]" />
                                    <span>{deal.activities_count}</span>
                                </div>
                            </Tooltip>
                        )}

                        {/* Show placeholder if no stats */}
                        {(deal.tasks_count ?? 0) === 0 &&
                            (deal.meetings_count ?? 0) === 0 &&
                            (deal.activities_count ?? 0) === 0 && (
                                <span className="text-[12px] text-gray-300">
                                    —
                                </span>
                            )}
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default DealCard;
