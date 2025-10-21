import {
    formatCurrency,
    getPropertyTypeColor,
    getStatusColor,
    truncateText,
} from "@/lib/utils";
import { Property } from "@/Types";
import { Link } from "@inertiajs/react";
import { Button, Dropdown, MenuProps, Tag } from "antd";
import { ColumnsType } from "antd/lib/table";
import { MoreOutlined } from "@ant-design/icons";

export const PROPERTY_TABLE_COLUMNS = (
    actionItems?: (item: Property) => MenuProps["items"]
): ColumnsType<Property> => [
    {
        title: "Title",
        dataIndex: "title",
        key: "title",
        width: 250,
        render: (title: string, record: Property) => (
            <div>
                <Link
                    href={route("properties.show", record.id)}
                    className="font-medium text-blue-600 hover:text-blue-800"
                >
                    {title}
                </Link>
                {record.product && (
                    <div className="text-xs text-gray-500 mt-1">
                        Product: {record.product.name}
                    </div>
                )}
            </div>
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
        title: "Price",
        dataIndex: "price",
        key: "price",
        width: 120,
        render: (price: number, record: Property) => (
            <div className="font-medium">
                {formatCurrency(price)}
                {record.sale_type === "rent" && (
                    <span className="text-xs text-gray-500">/month</span>
                )}
            </div>
        ),
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
