import React from "react";
import {
    Form,
    Select,
    DatePicker,
    Input,
    Row,
    Col,
    Divider,
    Typography,
    InputNumber,
    Switch,
    Tag,
} from "antd";
import { usePage } from "@inertiajs/react";
import { TFilter } from "@/Types/common";
import { PropertyEnumValues } from "@/Types";
import dayjs from "dayjs";

const { Title } = Typography;
const { RangePicker } = DatePicker;

interface AdvancedPropertyFilterFormProps {
    /**
     * Current filter values
     */
    filters: TFilter;

    /**
     * Function to handle filter changes
     */
    onFilterChange: (key: keyof TFilter, value: any) => void;
}

const AdvancedPropertyFilterForm: React.FC<AdvancedPropertyFilterFormProps> = ({
    filters,
    onFilterChange,
}) => {
    const { props } = usePage<any>();
    const { projects = [], developers = [], enumValues } = props;

    // Cast enumValues with proper typing
    const propertyEnums = enumValues as PropertyEnumValues | undefined;

    const {
        search,
        property_type,
        sale_type,
        status,
        city,
        min_price,
        max_price,
        start_date,
        end_date,
        // New filter fields
        primary_category,
        unit_style,
        construction_status,
        view_types,
        is_published,
        added_by,
        responsible_agent_id,
    } = filters;

    const propertyTypes = [
        // Housing Types
        "Villa",
        "Twin Villa",
        "Apartment",
        "Family Home",
        "Townhouse",
        "Loft",
        "Penthouse",
        "Bungalow",
        "Duplex",
        "Studio",
        "Maisonette",
        // Land Types
        "Residential Land",
        "Commercial Land",
        "Agricultural Land",
        "Mixed Use Land",
        "Industrially Zoned land",
        "Tourism Zoned Land",
        "Olive Grove",
        // Commercial Types
        "Shop",
        "Hotel",
        "Workplace",
        "Warehouse",
        "Workplace for sale",
        "Office",
    ];

    const saleTypes = ["For Sale", "For Rent", "For Daily Rental"];

    const statusOptions = [
        "Available",
        "Under offer",
        "Sold",
        "Rented",
        "Reserved",
        "Withdrawn",
        "Let agreed",
        "Sale agreed",
    ];

    return (
        <div className="space-y-6">
            {/* Basic Search */}
            <div>
                <Title level={5} className="!mb-3">
                    Search & General
                </Title>
                <Row gutter={[16, 16]}>
                    <Col span={24}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Search
                        </label>
                        <Input.Search
                            placeholder="Search properties by title, description, location..."
                            value={search}
                            onChange={(e) =>
                                onFilterChange("search", e.target.value)
                            }
                            allowClear
                        />
                    </Col>
                </Row>
            </div>

            <Divider />

            {/* Property Details */}
            <div>
                <Title level={5} className="!mb-3">
                    Property Details
                </Title>
                <Row gutter={[16, 16]}>
                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Property Type
                        </label>
                        <Select
                            value={property_type || undefined}
                            onChange={(value) =>
                                onFilterChange("property_type", value)
                            }
                            placeholder="Select property type"
                            style={{ width: "100%" }}
                            allowClear
                            showSearch
                            filterOption={(input, option) =>
                                (option?.children as unknown as string)
                                    ?.toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                        >
                            {propertyTypes.map((type) => (
                                <Select.Option key={type} value={type}>
                                    {type}
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>

                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Sale Type
                        </label>
                        <Select
                            value={sale_type || undefined}
                            onChange={(value) =>
                                onFilterChange("sale_type", value)
                            }
                            placeholder="Select sale type"
                            style={{ width: "100%" }}
                            allowClear
                        >
                            {saleTypes.map((type) => (
                                <Select.Option key={type} value={type}>
                                    {type}
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>

                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Status
                        </label>
                        <Select
                            value={status || undefined}
                            onChange={(value) =>
                                onFilterChange("status", value)
                            }
                            placeholder="Select status"
                            style={{ width: "100%" }}
                            allowClear
                        >
                            {statusOptions.map((status) => (
                                <Select.Option key={status} value={status}>
                                    {status}
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>

                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            City
                        </label>
                        <Select
                            value={city || undefined}
                            onChange={(value) => onFilterChange("city", value)}
                            placeholder="Select city"
                            style={{ width: "100%" }}
                            allowClear
                            showSearch
                            filterOption={(input, option) =>
                                (option?.children as unknown as string)
                                    ?.toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                        >
                            {propertyEnums?.cities?.map((c) => (
                                <Select.Option key={c.name} value={c.name}>
                                    {c.label}
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>
                </Row>
            </div>

            <Divider />

            {/* Property Classification */}
            <div>
                <Title level={5} className="!mb-3">
                    Property Classification
                </Title>
                <Row gutter={[16, 16]}>
                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Primary Category
                        </label>
                        <Select
                            value={
                                (filters as any).primary_category || undefined
                            }
                            onChange={(value) =>
                                onFilterChange(
                                    "primary_category" as keyof TFilter,
                                    value,
                                )
                            }
                            placeholder="Select category"
                            style={{ width: "100%" }}
                            allowClear
                        >
                            {propertyEnums?.primary_categories?.map((cat) => (
                                <Select.Option key={cat.name} value={cat.name}>
                                    {cat.label}
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>

                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Unit Style
                        </label>
                        <Select
                            value={(filters as any).unit_style || undefined}
                            onChange={(value) =>
                                onFilterChange(
                                    "unit_style" as keyof TFilter,
                                    value,
                                )
                            }
                            placeholder="Select unit style"
                            style={{ width: "100%" }}
                            allowClear
                        >
                            {propertyEnums?.unit_styles?.map((style) => (
                                <Select.Option
                                    key={style.name}
                                    value={style.name}
                                >
                                    {style.label}
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>

                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Construction Status
                        </label>
                        <Select
                            value={
                                (filters as any).construction_status ||
                                undefined
                            }
                            onChange={(value) =>
                                onFilterChange(
                                    "construction_status" as keyof TFilter,
                                    value,
                                )
                            }
                            placeholder="Select construction status"
                            style={{ width: "100%" }}
                            allowClear
                        >
                            {propertyEnums?.construction_statuses?.map(
                                (status) => (
                                    <Select.Option
                                        key={status.name}
                                        value={status.name}
                                    >
                                        {status.label}
                                    </Select.Option>
                                ),
                            )}
                        </Select>
                    </Col>

                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            View Types
                        </label>
                        <Select
                            mode="multiple"
                            value={(filters as any).view_types || []}
                            onChange={(value) =>
                                onFilterChange(
                                    "view_types" as keyof TFilter,
                                    value,
                                )
                            }
                            placeholder="Select view types"
                            style={{ width: "100%" }}
                            allowClear
                            maxTagCount={2}
                        >
                            {propertyEnums?.view_types?.map((view) => (
                                <Select.Option
                                    key={view.name}
                                    value={view.name}
                                >
                                    {view.label}
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>

                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Publishing Status
                        </label>
                        <Select
                            value={(filters as any).is_published}
                            onChange={(value) =>
                                onFilterChange(
                                    "is_published" as keyof TFilter,
                                    value,
                                )
                            }
                            placeholder="All properties"
                            style={{ width: "100%" }}
                            allowClear
                        >
                            <Select.Option value={true}>
                                <Tag color="green">Published</Tag>
                            </Select.Option>
                            <Select.Option value={false}>
                                <Tag color="orange">Draft</Tag>
                            </Select.Option>
                        </Select>
                    </Col>
                </Row>
            </div>

            <Divider />

            {/* Price Range */}
            <div>
                <Title level={5} className="!mb-3">
                    Price Range
                </Title>
                <Row gutter={[16, 16]}>
                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Minimum Price
                        </label>
                        <InputNumber
                            value={min_price}
                            onChange={(value) =>
                                onFilterChange("min_price", value)
                            }
                            placeholder="Min price"
                            style={{ width: "100%" }}
                            formatter={(value) =>
                                `$ ${value}`.replace(
                                    /\B(?=(\d{3})+(?!\d))/g,
                                    ",",
                                )
                            }
                            parser={(value) =>
                                Number(value!.replace(/\$\s?|(,*)/g, ""))
                            }
                            min={0}
                        />
                    </Col>

                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Maximum Price
                        </label>
                        <InputNumber
                            value={max_price}
                            onChange={(value) =>
                                onFilterChange("max_price", value)
                            }
                            placeholder="Max price"
                            style={{ width: "100%" }}
                            formatter={(value) =>
                                `$ ${value}`.replace(
                                    /\B(?=(\d{3})+(?!\d))/g,
                                    ",",
                                )
                            }
                            parser={(value) =>
                                Number(value!.replace(/\$\s?|(,*)/g, ""))
                            }
                            min={0}
                        />
                    </Col>
                </Row>
            </div>

            <Divider />

            {/* Date Filters */}
            <div>
                <Title level={5} className="!mb-3">
                    Date Range
                </Title>
                <Row gutter={[16, 16]}>
                    <Col span={24}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Created Date Range
                        </label>
                        <RangePicker
                            value={[
                                start_date ? dayjs(start_date) : null,
                                end_date ? dayjs(end_date) : null,
                            ]}
                            onChange={(dates, dateStrings) => {
                                onFilterChange(
                                    "start_date",
                                    dateStrings[0] || undefined,
                                );
                                onFilterChange(
                                    "end_date",
                                    dateStrings[1] || undefined,
                                );
                            }}
                            style={{ width: "100%" }}
                            format="YYYY-MM-DD"
                        />
                    </Col>
                </Row>
            </div>
        </div>
    );
};

export default AdvancedPropertyFilterForm;
