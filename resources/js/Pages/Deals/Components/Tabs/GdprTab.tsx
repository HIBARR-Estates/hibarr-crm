import { Deal } from "@/Types/api/deals";
import { Tag, Empty } from "antd";
import { DataTable } from "@/Components/DataTable";
import dayjs from "dayjs";

interface Props {
    deal: Deal;
    consents: any[];
    gdprSetting: any;
}

export default function GdprTab({ deal, consents, gdprSetting }: Props) {
    const columns = [
        {
            title: "Purpose",
            dataIndex: "name",
            key: "name",
            width: "30%",
            render: (name: string) => (
                <span className="font-medium text-gray-900">{name}</span>
            ),
        },
        {
            title: "Description",
            dataIndex: "description",
            key: "description",
            width: "40%",
            render: (description: string) => (
                <span className="text-sm text-gray-600">{description}</span>
            ),
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            width: "15%",
            render: (_: any, record: any) => {
                const hasConsent = record.lead && record.lead.length > 0;
                return (
                    <Tag color={hasConsent ? "green" : "red"}>
                        {hasConsent ? "Consented" : "Not Consented"}
                    </Tag>
                );
            },
        },
        {
            title: "Date",
            dataIndex: "updated_at",
            key: "updated_at",
            width: "15%",
            render: (date: string, record: any) => {
                if (record.lead && record.lead.length > 0) {
                    return (
                        <span className="text-sm text-gray-600">
                            {dayjs(record.lead[0].created_at).format(
                                "MMM DD, YYYY"
                            )}
                        </span>
                    );
                }
                return <span className="text-gray-400">--</span>;
            },
        },
    ];

    if (!gdprSetting?.enable_gdpr) {
        return (
            <div className="p-8">
                <Empty description="GDPR is not enabled" />
            </div>
        );
    }

    if (consents.length === 0) {
        return (
            <div className="p-8">
                <Empty description="No GDPR consents found" />
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    GDPR Consent Status
                </h3>
                <p className="text-sm text-gray-600">
                    Track consent status for data processing purposes.
                </p>
            </div>

            <DataTable
                columns={columns}
                dataSource={consents}
                rowKey="id"
                scroll={{ x: "max-content" }}
            />
        </div>
    );
}
