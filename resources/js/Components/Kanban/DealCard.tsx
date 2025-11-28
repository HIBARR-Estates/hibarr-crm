import React from "react";
import { Deal } from "@/Types/api/deals";
import { Avatar, Tag } from "antd";
import {
    UserOutlined,
    CalendarOutlined,
    DollarOutlined,
} from "@ant-design/icons";
import { Link } from "@inertiajs/react";
import dayjs from "dayjs";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface DealCardProps {
    deal: Deal;
    draggable?: boolean;
    onEdit?: (deal: Deal) => void;
}

const DealCard: React.FC<DealCardProps> = ({
    deal,
    draggable = true,
    onEdit,
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
        opacity: isDragging ? 0.5 : 1,
    };

    const handleCardClick = (e: React.MouseEvent) => {
        if (onEdit && !isDragging) {
            e.preventDefault();
            onEdit(deal);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`bg-white rounded-lg border border-gray-200 p-4 mb-3 mx-3 hover:shadow-sm transition-shadow cursor-pointer ${
                !draggable ? "move-disable" : ""
            } ${isDragging ? "z-50" : ""}`}
            data-task-id={deal.id}
            id={`drag-task-${deal.id}`}
            onClick={handleCardClick}
        >
            {/* Deal Title */}
            <div className="flex justify-between items-start mb-2">
                <Link
                    href={route("deals.show", deal.id)}
                    className="font-medium text-gray-900 hover:text-blue-600 text-sm leading-tight flex items-center"
                >
                    {deal.name}
                    {deal.contact?.client_id && (
                        <i
                            className="fa fa-check-circle text-green-500 ml-1"
                            title="Converted Client"
                        />
                    )}
                </Link>
            </div>

            {/* Client Name */}
            {deal.contact?.client_name && (
                <div className="mb-2">
                    <span className="text-xs text-gray-600">
                        {deal.contact.salutation &&
                            `${deal.contact.salutation} `}
                        {deal.contact.client_name}
                    </span>
                </div>
            )}

            {/* Deal Value */}

            <div className="flex items-center mb-3">
                <DollarOutlined className="text-gray-500 text-xs mr-1" />

                <span className="text-xs text-gray-600">
                    {deal?.currency?.currency_symbol || "€"}
                    {deal?.value?.toLocaleString() || "0"}
                </span>
            </div>

            <hr className="my-2 border-gray-100" />

            {/* Bottom Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2 text-xs">
                {/* Next Follow Up */}
                {deal.next_follow_up_date && (
                    <div className="flex items-center text-gray-500">
                        <CalendarOutlined className="mr-1" />
                        <span>
                            {dayjs(deal.next_follow_up_date).format(
                                "MMM DD, YYYY"
                            )}
                        </span>
                    </div>
                )}

                {/* Agent */}
                {deal.lead_agent?.user ? (
                    <a
                        href={route("employees.show", deal.lead_agent.user_id)}
                        className="flex items-center gap-2 hover:text-blue-600"
                    >
                        <span className="text-gray-600">
                            {deal.lead_agent.user.name}
                        </span>
                        <Avatar
                            size={24}
                            src={deal.lead_agent.user.image_url}
                            icon={<UserOutlined />}
                        />
                    </a>
                ) : (
                    <span
                        className="text-blue-600 hover:text-blue-800 text-xs cursor-pointer"
                        onClick={() => onEdit?.(deal)}
                    >
                        Assign Agent
                    </span>
                )}
            </div>
        </div>
    );
};

export default DealCard;
