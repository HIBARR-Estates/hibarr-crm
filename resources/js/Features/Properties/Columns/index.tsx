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
import { Button, Dropdown, MenuProps, Tag, Tooltip } from "antd";
import { ColumnsType } from "antd/lib/table";
import { MoreOutlined, BlockOutlined } from "@ant-design/icons";
import PageDataSorter from "@/Components/PageDataSorter";
import dayjs from "dayjs";

/** Helper: is this row a virtual unit type (not a real property)? */
const isUnitType = (record: Property) => record._source === "unit_type";

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

            const href = isUnitType(record)
                ? route("properties.unit-type.show", record._unit_type_id!)
                : route("properties.show", record.id);

            return (
                <div className="flex items-center gap-1.5">
                    <div>
                        <Link href={href} className="hover:text-blue-800">
                            {title && (
                                <div className="font-semibold text-sm text-gray-900 leading-tight">
                                    {truncateText(title, 50)}
                                </div>
                            )}
                            <span className="text-xs text-gray-500 mt-0.5">
                                {referenceCode}
                            </span>
                        </Link>
                    </div>
                    {isUnitType(record) && (
                        <Tooltip title="This is a developer project unit type">
                            <Tag
                                color="purple"
                                icon={<BlockOutlined />}
                                className="ml-1 text-[10px] leading-tight"
                            >
                                Unit Type
                            </Tag>
                        </Tooltip>
                    )}
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
        title: "Project",
        key: "developer_project",
        width: 140,
        render: (_, record: Property) => {
            const project = record?.developer_project;
            if (!project) return <span className="text-gray-400">—</span>;
            return (
                <span className="text-sm text-gray-800">
                    {truncateText(project.name, 25)}
                </span>
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
        render: (status: string, record: Property) => (
            <div className="flex items-center gap-1">
                <Tag color={getStatusColor(status)}>{status}</Tag>
                {isUnitType(record) && (record._sold_count ?? 0) > 0 && (
                    <Tooltip
                        title={
                            (record._sold_count ?? 0) > 1
                                ? `Sold ${record._sold_count} times`
                                : "View sold property"
                        }
                    >
                        <Link
                            href={route(
                                "properties.show",
                                record._sold_property_ids![0],
                            )}
                            className="text-[10px] text-blue-600 hover:underline"
                        >
                            {(record._sold_count ?? 0) === 1
                                ? "View Property"
                                : `${record._sold_count} Sold`}
                        </Link>
                    </Tooltip>
                )}
            </div>
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
        render: (_, record: Property) => {
            // Unit type rows only get a "View" link — no edit/delete
            if (isUnitType(record)) {
                return (
                    <Link
                        href={route(
                            "properties.unit-type.show",
                            record._unit_type_id!,
                        )}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                        View
                    </Link>
                );
            }

            return (
                <Dropdown
                    menu={{ items: actionItems?.(record) }}
                    trigger={["click"]}
                    placement="bottomRight"
                >
                    <Button type="text" icon={<MoreOutlined />} />
                </Dropdown>
            );
        },
    },
];
