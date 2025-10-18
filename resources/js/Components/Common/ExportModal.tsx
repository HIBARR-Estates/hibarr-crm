import { useState, useEffect } from "react";
import {
    Form,
    Select,
    DatePicker,
    Button,
    Space,
    Row,
    Col,
    InputNumber,
    Input,
    message,
    Divider,
    Drawer,
} from "antd";
import { DownloadOutlined, FilterOutlined } from "@ant-design/icons";

const { Option } = Select;
const { RangePicker } = DatePicker;

interface ExportModalProps {
    visible: boolean;
    onClose: () => void;
    onExport: (filters: any) => void;
    loading?: boolean;
    title?: string;
    description?: string;
}

interface ExportFilters {
    property_type?: string;
    sale_type?: string;
    status?: string;
    city?: string;
    min_price?: number;
    max_price?: number;
    date_from?: string;
    date_to?: string;
    search?: string;
}

const propertyTypes = [
    "Villa",
    "Twin Villa",
    "Apartment",
    "Family Home",
    "Townhouse",
    "Loft",
    "Penthouse",
    "Bungalow",
    "Commercial Property",
    "Block of apartments",
    "Complete Building",
    "Abandoned Building",
    "Residence",
    "Half Construction",
    "Time Share",
    "Residentially Zoned Land",
    "Field",
    "Residentially and Commercially Zoned Land",
    "Commercially Zoned Land",
    "Industrially Zoned land",
    "Tourism Zoned Land",
    "Olive Grove",
    "Shop",
    "Hotel",
    "Workplace",
    "Warehouse",
    "Workplace for sale",
    "Office",
];

const saleTypes = ["For Sale", "For Rent", "For Daily Rental"];

const statusOptions = ["Available", "Under offer", "Sold", "Withdrawn"];

export default function ExportModal({
    visible,
    onClose,
    onExport,
    loading = false,
    title = "Export Properties",
    description = "Configure export filters and download property data",
}: ExportModalProps) {
    const [form] = Form.useForm();
    const [filters, setFilters] = useState<ExportFilters>({});

    useEffect(() => {
        if (visible) {
            form.resetFields();
            setFilters({});
        }
    }, [visible, form]);

    const handleExport = async () => {
        try {
            const values = await form.validateFields();

            // Format date range if provided
            const exportFilters: ExportFilters = { ...values };

            if (values.dateRange && values.dateRange.length === 2) {
                exportFilters.date_from =
                    values.dateRange[0].format("YYYY-MM-DD");
                exportFilters.date_to =
                    values.dateRange[1].format("YYYY-MM-DD");
                // delete exportFilters.dateRange;
            }

            onExport(exportFilters);
        } catch (error) {
            message.error("Please check your input and try again");
        }
    };

    const handleReset = () => {
        form.resetFields();
        setFilters({});
    };

    return (
        <Drawer
            title={
                <div className="flex items-center gap-2">
                    <DownloadOutlined />
                    <span>{title}</span>
                </div>
            }
            open={visible}
            onClose={onClose}
            width={600}
            footer={
                <div className="flex justify-between">
                    <Button onClick={handleReset}>Reset Filters</Button>
                    <Space>
                        <Button onClick={onClose}>Cancel</Button>
                        <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            onClick={handleExport}
                            loading={loading}
                        >
                            Export Data
                        </Button>
                    </Space>
                </div>
            }
        >
            <div className="mb-4">
                <p className="text-gray-600">{description}</p>
            </div>

            <Form form={form} layout="vertical" initialValues={{}}>
                {/* Basic Filters */}
                <Divider orientation="left">
                    <span className="flex items-center gap-1">
                        <FilterOutlined />
                        Basic Filters
                    </span>
                </Divider>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item label="Property Type" name="property_type">
                            <Select
                                placeholder="Select property type"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                            >
                                {propertyTypes.map((type) => (
                                    <Option key={type} value={type}>
                                        {type}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="Sale Type" name="sale_type">
                            <Select placeholder="Select sale type" allowClear>
                                {saleTypes.map((type) => (
                                    <Option key={type} value={type}>
                                        {type}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item label="Status" name="status">
                            <Select placeholder="Select status" allowClear>
                                {statusOptions.map((status) => (
                                    <Option key={status} value={status}>
                                        {status}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="City" name="city">
                            <Input placeholder="Enter city name" allowClear />
                        </Form.Item>
                    </Col>
                </Row>

                {/* Price Range */}
                <Divider orientation="left">Price Range</Divider>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item label="Minimum Price" name="min_price">
                            <InputNumber
                                placeholder="0"
                                min={0}
                                style={{ width: "100%" }}
                                formatter={(value) =>
                                    `$ ${value}`.replace(
                                        /\B(?=(\d{3})+(?!\d))/g,
                                        ","
                                    )
                                }
                                parser={(value) =>
                                    value!.replace(/\$\s?|(,*)/g, "") as any
                                }
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="Maximum Price" name="max_price">
                            <InputNumber
                                placeholder="No limit"
                                min={0}
                                style={{ width: "100%" }}
                                formatter={(value) =>
                                    `$ ${value}`.replace(
                                        /\B(?=(\d{3})+(?!\d))/g,
                                        ","
                                    )
                                }
                                parser={(value) =>
                                    value!.replace(/\$\s?|(,*)/g, "") as any
                                }
                            />
                        </Form.Item>
                    </Col>
                </Row>

                {/* Date Range */}
                <Divider orientation="left">Date Range</Divider>

                <Form.Item
                    label="Creation Date Range"
                    name="dateRange"
                    tooltip="Filter properties by their creation date"
                >
                    <RangePicker
                        style={{ width: "100%" }}
                        format="YYYY-MM-DD"
                        placeholder={["Start Date", "End Date"]}
                    />
                </Form.Item>

                {/* Search */}
                <Divider orientation="left">Search</Divider>

                <Form.Item
                    label="Search Text"
                    name="search"
                    tooltip="Search in title, description, area, and city fields"
                >
                    <Input placeholder="Search properties..." allowClear />
                </Form.Item>
            </Form>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700 mb-2">
                    <strong>Export Information:</strong>
                </p>
                <ul className="text-xs text-blue-600 space-y-1">
                    <li>• Exported file will be in Excel (.xlsx) format</li>
                    <li>
                        • All visible columns will be included in the export
                    </li>
                    <li>
                        • Filters applied here will affect the exported data
                    </li>
                    <li>• Large exports may take a few moments to process</li>
                </ul>
            </div>
        </Drawer>
    );
}
