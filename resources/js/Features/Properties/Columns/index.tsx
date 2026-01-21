import {
    getPropertyTypeColor,
    getStatusColor,
    truncateText,
    parsePropertyPrice,
    formatCurrencyWithSymbol,
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
    defaultCurrencySymbol: string | null | undefined = ""
): ColumnsType<Property> => [
    {
        title: (
            <span className="flex items-center">
                Title
                <PageDataSorter field="title" routeName="properties.index" />
            </span>
        ),
        dataIndex: "title",
        key: "title",
        width: 250,
        render: (title: string, record: Property) => (
            <Link
                href={route("properties.show", record.id)}
                className="font-medium text-blue-600 hover:text-blue-800"
            >
                {title}
            </Link>
        ),
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
                defaultCurrencyCode || "TRY"
            );
            const symbol =
                currencies.find((c: any) => c?.currency_code === currency)?.currency_symbol ||
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
        render: (_, record: Property) => (
            <div>
                <div className="font-medium">{record.city}</div>
                <div className="text-xs text-gray-500">{record.area}</div>
            </div>
        ),
    },
    {
        title: "Details",
        key: "details",
        width: 120,
        render: (_, record: Property) => (
            <div className="text-sm">
                <div>🛏️ {record?.bedrooms ?? "No"} bed</div>
                <div>🚿 {record?.bathrooms ?? "No"} bath</div>
            </div>
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
