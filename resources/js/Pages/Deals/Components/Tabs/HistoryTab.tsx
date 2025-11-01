import { Deal } from "@/Types/api/deals";
import { Table, Avatar, Empty } from "antd";
import { UserOutlined, ClockCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

interface Props {
    deal: Deal;
    histories: any[];
}

export default function HistoryTab({ deal, histories }: Props) {
    const columns = [
        {
            title: "Activity",
            dataIndex: "details",
            key: "details",
            width: "50%",
            render: (details: string) => (
                <div className="text-sm text-gray-900">{details}</div>
            ),
        },
        {
            title: "User",
            dataIndex: "added_by",
            key: "added_by",
            width: "25%",
            render: (addedBy: any) => (
                <div className="flex items-center space-x-2">
                    <Avatar
                        size="small"
                        src={addedBy?.image}
                        icon={<UserOutlined />}
                    />
                    <span className="text-sm">{addedBy?.name || "System"}</span>
                </div>
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
            <Table
                columns={columns}
                dataSource={histories}
                rowKey="id"
                pagination={{
                    pageSize: 15,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `Total ${total} activities`,
                }}
                className="history-table"
            />
        </div>
    );
}
