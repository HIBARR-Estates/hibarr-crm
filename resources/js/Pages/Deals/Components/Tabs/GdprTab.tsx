import { Deal } from "@/Types/api/deals";
import { Tag, Empty } from "antd";
import { DataTable } from "@/Components/DataTable";
import { formatCompanyDate } from "@/lib/companyDateTime";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface Props {
    deal: Deal;
    consents: any[];
    gdprSetting: any;
}

export default function GdprTab({ deal, consents, gdprSetting }: Props) {
    const { td } = useTd();
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
                            {formatCompanyDate(record.lead[0].created_at)}
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
                <Empty description={td("GDPR is not enabled", { source: "en" })} />
            </div>
        );
    }

    if (consents.length === 0) {
        return (
            <div className="p-8">
                <Empty description={td("No GDPR consents found", { source: "en" })} />
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {td("GDPR Consent Status", { source: "en" })}
                </h3>
                <p className="text-sm text-gray-600">
                    {td("Track consent status for data processing purposes.", { source: "en" })}
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
