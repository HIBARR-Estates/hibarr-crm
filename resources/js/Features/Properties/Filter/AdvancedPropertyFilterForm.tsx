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
import { useTd } from "@/Hooks/useDynamicTranslation";

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
    const { td } = useTd();
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
        "Apartment",
        "Villa",
        "Semi-Detached Villa",
        "Bungalow",
        "Townhouse",
        "Complete Building",
        "Ruin",
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
                            {td("Search", { source: "en" })}
                        </label>
                        <Input.Search
                            placeholder={td("Search properties by title, description, location...", { source: "en" })}
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
                    {td("Property Details", { source: "en" })}
                </Title>
                <Row gutter={[16, 16]}>
                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {td("Property Type", { source: "en" })}
                        </label>
                        <Select
                            value={property_type || undefined}
                            onChange={(value) =>
                                onFilterChange("property_type", value)
                            }
                            placeholder={td("Select property type", { source: "en" })}
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
                            {td("Sale Type", { source: "en" })}
                        </label>
                        <Select
                            value={sale_type || undefined}
                            onChange={(value) =>
                                onFilterChange("sale_type", value)
                            }
                            placeholder={td("Select sale type", { source: "en" })}
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
                            {td("Status", { source: "en" })}
                        </label>
                        <Select
                            value={status || undefined}
                            onChange={(value) =>
                                onFilterChange("status", value)
                            }
                            placeholder={td("Select status", { source: "en" })}
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
                            {td("City", { source: "en" })}
                        </label>
                        <Select
                            value={city || undefined}
                            onChange={(value) => onFilterChange("city", value)}
                            placeholder={td("Select city", { source: "en" })}
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
                    {td("Property Classification", { source: "en" })}
                </Title>
                <Row gutter={[16, 16]}>
                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {td("Primary Category", { source: "en" })}
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
                            placeholder={td("Select category", { source: "en" })}
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
                            {td("Unit Style", { source: "en" })}
                        </label>
                        <Select
                            value={(filters as any).unit_style || undefined}
                            onChange={(value) =>
                                onFilterChange(
                                    "unit_style" as keyof TFilter,
                                    value,
                                )
                            }
                            placeholder={td("Select unit style", { source: "en" })}
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
                            {td("Construction Status", { source: "en" })}
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
                            placeholder={td("Select construction status", { source: "en" })}
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
                            {td("View Types", { source: "en" })}
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
                            placeholder={td("Select view types", { source: "en" })}
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
                            {td("Publishing Status", { source: "en" })}
                        </label>
                        <Select
                            value={(filters as any).is_published}
                            onChange={(value) =>
                                onFilterChange(
                                    "is_published" as keyof TFilter,
                                    value,
                                )
                            }
                            placeholder={td("All properties", { source: "en" })}
                            style={{ width: "100%" }}
                            allowClear
                        >
                            <Select.Option value={true}>
                                <Tag color="green">{td("Published", { source: "en" })}</Tag>
                            </Select.Option>
                            <Select.Option value={false}>
                                <Tag color="orange">{td("Draft", { source: "en" })}</Tag>
                            </Select.Option>
                        </Select>
                    </Col>
                </Row>
            </div>

            <Divider />

            {/* Price Range */}
            <div>
                <Title level={5} className="!mb-3">
                    {td("Price Range", { source: "en" })}
                </Title>
                <Row gutter={[16, 16]}>
                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {td("Minimum Price", { source: "en" })}
                        </label>
                        <InputNumber
                            value={min_price}
                            onChange={(value) =>
                                onFilterChange("min_price", value)
                            }
                            placeholder={td("Min price", { source: "en" })}
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
                            {td("Maximum Price", { source: "en" })}
                        </label>
                        <InputNumber
                            value={max_price}
                            onChange={(value) =>
                                onFilterChange("max_price", value)
                            }
                            placeholder={td("Max price", { source: "en" })}
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
                    {td("Date Range", { source: "en" })}
                </Title>
                <Row gutter={[16, 16]}>
                    <Col span={24}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {td("Created Date Range", { source: "en" })}
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
