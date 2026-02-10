import {
    getPropertyTypeColor,
    getStatusColor,
    truncateText,
    parsePropertyPrice,
    formatCurrencyWithSymbol,
    generatePropertySubtitle,
} from "@/lib/utils";
import { Property } from "@/Types";
import { Link } from "@inertiajs/react";
import { Button, Dropdown, MenuProps, Tag } from "antd";
import { ColumnsType } from "antd/lib/table";
import { MoreOutlined } from "@ant-design/icons";
import PageDataSorter from "@/Components/PageDataSorter";
import dayjs from "dayjs";

export const PROPERTY_TABLE_COLUMNS = (
    actionItems?: (item: Property) => MenuProps["items"],
    currencies: any[] = [],
    defaultCurrencyCode: string | null | undefined = "TRY",
    defaultCurrencySymbol: string | null | undefined = "",
): ColumnsType<Property> => [
    {
        title: (
            <span className="flex items-center">
                Title
                <PageDataSorter field="title" routeName="properties.index" />
            </span>
        ),
        dataIndex: "display_title",
        key: "title",
        width: 250,
        render: (displayTitle: string, record: Property) => {
            const title = generatePropertySubtitle(record);
            const referenceCode =
                record?.reference_code ||
                displayTitle ||
                `Property #${record.id}`;
            return (
                <div>
                    <Link
                        href={route("properties.show", record.id)}
                        className="font-medium text-blue-600 hover:text-blue-800"
                    >
                        {title && (
                            <div className="text-xs text-gray-500 mt-0.5 leading-tight hover:text-gray-700">
                                {truncateText(title, 50)}
                            </div>
                        )}
                        <span>{referenceCode}</span>
                    </Link>
                </div>
            );
        },
    },
    {
        title: "Type",
        dataIndex: "property_type",
        key: "property_type",
        width: 120,
        render: (type: string) => (
            <Tag color={getPropertyTypeColor(type)}>
                {truncateText(type.replace("_", " ").toUpperCase(), 14)}
            </Tag>
        ),
    },
    {
        title: "Sale Type",
        dataIndex: "sale_type",
        key: "sale_type",
        width: 100,
        render: (saleType: string) => (
            <Tag color={saleType === "For Sale" ? "red" : "blue"}>
                {saleType}
            </Tag>
        ),
    },
    {
        title: (
            <span className="flex items-center">
                Price
                <PageDataSorter field="price" routeName="properties.index" />
            </span>
        ),
        dataIndex: "price",
        key: "price",
        width: 120,
        render: (price: any, record: Property) => {
            const { amount, currency } = parsePropertyPrice(
                price,
                defaultCurrencyCode || "TRY",
            );
            const symbol =
                currencies.find((c: any) => c?.currency_code === currency)
                    ?.currency_symbol ||
                defaultCurrencySymbol ||
                "";

            return (
                <div className="font-medium">
                    {formatCurrencyWithSymbol(amount, symbol)}
                    {record.sale_type === "rent" && (
                        <span className="text-xs text-gray-500">/month</span>
                    )}
                </div>
            );
        },
    },
    {
        title: "Location",
        key: "location",
        width: 150,
        render: (_, record: Property) => {
            // Use effective_location which derives from project location or falls back to direct values
            const city = record.effective_location?.city ?? record.city;
            const area = record.effective_location?.area ?? record.area;
            return (
                <div>
                    <div className="font-medium">{city}</div>
                    <div className="text-xs text-gray-500">{area}</div>
                </div>
            );
        },
    },
    {
        title: "Visibility",
        key: "publish_status",
        width: 120,
        render: (_, record: Property) => (
            <Tag color={record.is_published ? "green" : "orange"}>
                {record.is_published ? "Published" : "Draft"}
            </Tag>
        ),
    },
    {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 120,
        render: (status: string) => (
            <Tag color={getStatusColor(status)}>{status}</Tag>
        ),
    },
    {
        title: (
            <span className="flex items-center">
                Created
                <PageDataSorter
                    field="created_at"
                    routeName="properties.index"
                />
            </span>
        ),
        key: "created_at",
        width: 120,
        render: (_, record: Property) => (
            <span className="text-gray-900">
                {dayjs(record.created_at).format("MMM DD, YYYY")}
            </span>
        ),
    },
    {
        title: "Actions",
        key: "actions",
        width: 80,
        fixed: "right",
        render: (_, record: Property) => (
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
