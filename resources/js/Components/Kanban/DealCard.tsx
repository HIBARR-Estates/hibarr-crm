import React from "react";
import { Deal } from "@/Types/api/deals";
import { Card, Dropdown, Button, Typography, Tooltip } from "antd";
import type { MenuProps } from "antd";
import {
    EllipsisOutlined as MoreOutlined,
    CalendarOutlined,
    CheckSquareOutlined,
    VideoCameraOutlined,
    MessageOutlined,
    EditOutlined,
    UserAddOutlined,
} from "@ant-design/icons";
import { Link } from "@inertiajs/react";
import dayjs from "dayjs";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import MultiUserIndicator from "../MultiUserIndicator";

const { Text } = Typography;

interface DealCardProps {
    deal: Deal;
    draggable?: boolean;
    onEdit?: (deal: Deal) => void;
    onAssignAgent?: (deal: Deal) => void;
}

const DealCard: React.FC<DealCardProps> = ({
    deal,
    draggable = true,
    onEdit,
    onAssignAgent,
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
        disabled: !draggable,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    // Format currency
    const formattedValue = `${deal?.currency?.currency_symbol || "€"}${deal?.value?.toLocaleString() || "0"}`;

    // Format date
    const formattedDate = deal.created_at
        ? dayjs(deal.created_at).format("MMM D, YYYY")
        : null;

    // Prepare agent user for MultiUserIndicator
    const agentUser = deal.lead_agent?.user
        ? [
              {
                  id: deal.lead_agent.user.id,
                  name: deal.lead_agent.user.name,
                  image_url: deal.lead_agent.user.image_url,
              },
          ]
        : [];

    // Action items for dropdown
    const actionItems: MenuProps["items"] = [
        {
            key: "edit",
            icon: <EditOutlined />,
            label: "Edit Deal",
            onClick: (e) => {
                e.domEvent.stopPropagation();
                e.domEvent.preventDefault();
                onEdit?.(deal);
            },
        },
        {
            key: "assign",
            icon: <UserAddOutlined />,
            label: deal.lead_agent ? "Reassign Agent" : "Assign Agent",
            onClick: (e) => {
                e.domEvent.stopPropagation();
                e.domEvent.preventDefault();
                onAssignAgent?.(deal);
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
                    ${isDragging ? "shadow-lg ring-1 ring-blue-400 rotate-1 opacity-60" : "hover:shadow-md hover:border-gray-300"}
                    border border-gray-200
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
                                className="text-[13px] text-gray-800 leading-tight block hover:text-blue-600 transition-colors"
                                ellipsis={{ tooltip: deal.name }}
                            >
                                <span className="font-medium">{deal.name}</span>
                                {deal.contact?.client_id && (
                                    <i
                                        className="fa fa-check-circle text-green-500 ml-1 text-[10px]"
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

                {/* Lead/Contact Name */}
                {deal.contact?.client_name && (
                    <div className="mb-2">
                        <Text
                            className="text-[11px] text-gray-500 leading-tight"
                            ellipsis={{
                                tooltip: `${deal.contact.salutation ? deal.contact.salutation + " " : ""}${deal.contact.client_name}`,
                            }}
                        >
                            {deal.contact.salutation &&
                                `${deal.contact.salutation} `}
                            {deal.contact.client_name}
                        </Text>
                    </div>
                )}

                {/* Agent + Deal Value Row */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0">
                        {agentUser.length > 0 ? (
                            <div className="flex items-center gap-1.5">
                                <MultiUserIndicator
                                    users={agentUser}
                                    size="xs"
                                    maxCount={1}
                                    showNames={false}
                                    showTooltip={true}
                                />
                                <Tooltip title={agentUser[0].name}>
                                    <Text
                                        className="text-[11px] text-gray-600 truncate max-w-[70px]"
                                        ellipsis
                                    >
                                        {agentUser[0].name}
                                    </Text>
                                </Tooltip>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center">
                                    <span className="text-gray-400 text-[8px]">
                                        ?
                                    </span>
                                </div>
                                <Text
                                    className="text-[11px] text-blue-600 cursor-pointer hover:text-blue-700 font-medium"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAssignAgent?.(deal);
                                    }}
                                >
                                    Assign
                                </Text>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center">
                        <Text strong className="text-[13px] text-gray-800">
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
                                title={`Created: ${dayjs(deal.created_at).format("MMM D, YYYY h:mm A")}`}
                            >
                                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                    <CalendarOutlined className="text-[10px]" />
                                    <span>{formattedDate}</span>
                                </div>
                            </Tooltip>
                        ) : (
                            <span className="text-[10px] text-gray-300">
                                No date
                            </span>
                        )}
                    </div>

                    {/* Stats: Tasks, Meetings, Activities */}
                    <div className="flex items-center gap-2">
                        {(deal.tasks_count ?? 0) > 0 && (
                            <Tooltip title={`${deal.tasks_count} Tasks`}>
                                <div className="flex items-center gap-0.5 text-[10px] text-gray-400">
                                    <CheckSquareOutlined className="text-[10px]" />
                                    <span>{deal.tasks_count}</span>
                                </div>
                            </Tooltip>
                        )}

                        {(deal.meetings_count ?? 0) > 0 && (
                            <Tooltip title={`${deal.meetings_count} Meetings`}>
                                <div className="flex items-center gap-0.5 text-[10px] text-gray-400">
                                    <VideoCameraOutlined className="text-[10px]" />
                                    <span>{deal.meetings_count}</span>
                                </div>
                            </Tooltip>
                        )}

                        {(deal.activities_count ?? 0) > 0 && (
                            <Tooltip
                                title={`${deal.activities_count} Activities`}
                            >
                                <div className="flex items-center gap-0.5 text-[10px] text-gray-400">
                                    <MessageOutlined className="text-[10px]" />
                                    <span>{deal.activities_count}</span>
                                </div>
                            </Tooltip>
                        )}

                        {/* Show placeholder if no stats */}
                        {(deal.tasks_count ?? 0) === 0 &&
                            (deal.meetings_count ?? 0) === 0 &&
                            (deal.activities_count ?? 0) === 0 && (
                                <span className="text-[10px] text-gray-300">
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
