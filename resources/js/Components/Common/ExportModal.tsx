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
import { useTd } from "@/Hooks/useDynamicTranslation";

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
    "Apartment",
    "Villa",
    "Semi-Detached Villa",
    "Bungalow",
    "Townhouse",
    "Complete Building",
    "Ruin",
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
    const { td } = useTd();
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
            message.error(td("Please check your input and try again", { source: "en" }));
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
                    <Button onClick={handleReset}>{td("Reset Filters", { source: "en" })}</Button>
                    <Space>
                        <Button onClick={onClose}>{td("Cancel", { source: "en" })}</Button>
                        <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            onClick={handleExport}
                            loading={loading}
                        >
                            {td("Export Data", { source: "en" })}
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
                        {td("Basic Filters", { source: "en" })}
                    </span>
                </Divider>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item label={td("Property Type", { source: "en" })} name="property_type">
                            <Select
                                placeholder={td("Select property type", { source: "en" })}
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
                        <Form.Item label={td("Sale Type", { source: "en" })} name="sale_type">
                            <Select placeholder={td("Select sale type", { source: "en" })} allowClear>
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
                        <Form.Item label={td("Status", { source: "en" })} name="status">
                            <Select placeholder={td("Select status", { source: "en" })} allowClear>
                                {statusOptions.map((status) => (
                                    <Option key={status} value={status}>
                                        {status}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label={td("City", { source: "en" })} name="city">
                            <Input placeholder={td("Enter city name", { source: "en" })} allowClear />
                        </Form.Item>
                    </Col>
                </Row>

                {/* Price Range */}
                <Divider orientation="left">{td("Price Range", { source: "en" })}</Divider>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item label={td("Minimum Price", { source: "en" })} name="min_price">
                            <InputNumber
                                placeholder="0"
                                min={0}
                                style={{ width: "100%" }}
                                formatter={(value) =>
                                    `$ ${value}`.replace(
                                        /\B(?=(\d{3})+(?!\d))/g,
                                        ",",
                                    )
                                }
                                parser={(value) =>
                                    value!.replace(/\$\s?|(,*)/g, "") as any
                                }
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label={td("Maximum Price", { source: "en" })} name="max_price">
                            <InputNumber
                                placeholder={td("No limit", { source: "en" })}
                                min={0}
                                style={{ width: "100%" }}
                                formatter={(value) =>
                                    `$ ${value}`.replace(
                                        /\B(?=(\d{3})+(?!\d))/g,
                                        ",",
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
                <Divider orientation="left">{td("Date Range", { source: "en" })}</Divider>

                <Form.Item
                    label={td("Creation Date Range", { source: "en" })}
                    name="dateRange"
                    tooltip={td("Filter properties by their creation date", { source: "en" })}
                >
                    <RangePicker
                        style={{ width: "100%" }}
                        format="YYYY-MM-DD"
                        placeholder={["Start Date", "End Date"]}
                    />
                </Form.Item>

                {/* Search */}
                <Divider orientation="left">{td("Search", { source: "en" })}</Divider>

                <Form.Item
                    label={td("Search Text", { source: "en" })}
                    name="search"
                    tooltip={td("Search in title, description, area, and city fields", { source: "en" })}
                >
                    <Input placeholder={td("Search properties...", { source: "en" })} allowClear />
                </Form.Item>
            </Form>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700 mb-2">
                    <strong>{td("Export Information:", { source: "en" })}</strong>
                </p>
                <ul className="text-xs text-blue-600 space-y-1">
                    <li>{td("• Exported file will be in Excel (.xlsx) format", { source: "en" })}</li>
                    <li>
                        {td("• All visible columns will be included in the export", { source: "en" })}
                    </li>
                    <li>
                        {td("• Filters applied here will affect the exported data", { source: "en" })}
                    </li>
                    <li>{td("• Large exports may take a few moments to process", { source: "en" })}</li>
                </ul>
            </div>
        </Drawer>
    );
}
