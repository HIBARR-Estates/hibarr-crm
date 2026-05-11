import { useState, useMemo } from "react";
import { Deal } from "@/Types/api/deals";
import { Empty } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import { DataTable } from "@/Components/DataTable";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
import dayjs from "dayjs";
import UserIndicator from "@/Components/UserIndicator";

interface Props {
    deal: Deal;
    histories: any[];
}

const HISTORY_PAGE_SIZE = 15;

export default function HistoryTab({ deal, histories }: Props) {
    const [page, setPage] = useState(1);

    const pagedHistories = useMemo(
        () => histories.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE),
        [histories, page],
    );

    const paginationMeta: LaravelPaginationMeta | null = histories.length > HISTORY_PAGE_SIZE ? {
        current_page: page,
        last_page: Math.ceil(histories.length / HISTORY_PAGE_SIZE),
        per_page: HISTORY_PAGE_SIZE,
        total: histories.length,
        from: (page - 1) * HISTORY_PAGE_SIZE + 1,
        to: Math.min(page * HISTORY_PAGE_SIZE, histories.length),
    } : null;

    const columns = [
        {
            title: "Activity",
            dataIndex: "event_type",
            key: "event_type",
            width: "50%",
            render: (event_type: string) => (
                <div className="text-sm text-gray-900 capitalize">
                    {event_type.split("-").join(" ")}
                </div>
            ),
        },
        {
            title: "User",
            dataIndex: "added_by",
            key: "added_by",
            width: "25%",
            render: (addedBy: any) => (
                <UserIndicator
                    data={{
                        image_url: addedBy?.image,
                        name: addedBy?.name || "System",
                    }}
                    size="xs"
                />
            ),
        },
        {
            title: "Date & Time",
            dataIndex: "created_at",
            key: "created_at",
            width: "25%",
            render: (date: string) => (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <ClockCircleOutlined className="text-gray-400" />
                    <div>
                        <div>{dayjs(date).format("MMM DD, YYYY")}</div>
                        <div className="text-xs">
                            {dayjs(date).format("h:mm A")}
                        </div>
                    </div>
                </div>
            ),
        },
    ];

    if (histories.length === 0) {
        return (
            <div className="p-8">
                <Empty description="No history found" />
            </div>
        );
    }

    return (
        <div className="p-6">
            <DataTable
                columns={columns}
                dataSource={pagedHistories}
                rowKey="id"
                size="small"
                scroll={{ x: "max-content" }}
                paginationData={paginationMeta}
                onPageChange={setPage}
            />
        </div>
    );
}
