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
} from "antd";
import { usePage } from "@inertiajs/react";
import { TFilter } from "@/Types/common";
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
    const { projects = [], developers = [] } = props;

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
                        <Input
                            value={city}
                            onChange={(e) =>
                                onFilterChange("city", e.target.value)
                            }
                            placeholder="Enter city name"
                            allowClear
                        />
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
                                    ","
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
                                    ","
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
                                    dateStrings[0] || undefined
                                );
                                onFilterChange(
                                    "end_date",
                                    dateStrings[1] || undefined
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
