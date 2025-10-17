import { IModalProps } from "@/Types/common";
import { Drawer, Space, Button, Form, Select, Input, Row, Col } from "antd";
import form from "antd/es/form";
import React from "react";

interface Props extends IModalProps {
    handleReset: { fn: () => void; loading?: boolean };
    handleSubmit: { fn: () => void; loading?: boolean };
}

const AdvancedPropertyFilter: React.FC<Props> = ({
    onClose,
    open: filterDrawerVisible,
    handleReset: { fn: handleResetFilters, loading: resetLoading },
    handleSubmit: { fn: handleFilterSubmit, loading: filterLoading },
}) => {
    const [form] = Form.useForm();
    const loading = resetLoading || filterLoading;
    return (
        <Drawer
            title="Advanced Filters"
            placement="right"
            width={400}
            onClose={onClose}
            open={filterDrawerVisible}
            extra={
                <Space>
                    <Button onClick={handleResetFilters} loading={loading}>
                        Reset
                    </Button>
                    <Button
                        type="primary"
                        onClick={() => form.submit()}
                        loading={loading}
                    >
                        Apply Filters
                    </Button>
                </Space>
            }
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleFilterSubmit}
                disabled={loading}
            >
                <Form.Item label="Property Type" name="property_type">
                    <Select
                        placeholder="Select property type"
                        allowClear
                        options={[
                            { value: "Villa", label: "Villa" },
                            { value: "Apartment", label: "Apartment" },
                            { value: "House", label: "House" },
                            { value: "Office", label: "Office" },
                            { value: "Shop", label: "Shop" },
                            { value: "Warehouse", label: "Warehouse" },
                        ]}
                    />
                </Form.Item>

                <Form.Item label="Sale Type" name="sale_type">
                    <Select
                        placeholder="Select sale type"
                        allowClear
                        options={[
                            { value: "For Sale", label: "For Sale" },
                            { value: "For Rent", label: "For Rent" },
                            {
                                value: "For Daily Rental",
                                label: "For Daily Rental",
                            },
                        ]}
                    />
                </Form.Item>

                <Form.Item label="Status" name="status">
                    <Select
                        placeholder="Select status"
                        allowClear
                        options={[
                            { value: "Available", label: "Available" },
                            { value: "Under offer", label: "Under Offer" },
                            { value: "Sold", label: "Sold" },
                            { value: "Rented", label: "Rented" },
                            { value: "Withdrawn", label: "Withdrawn" },
                        ]}
                    />
                </Form.Item>

                <Form.Item label="City" name="city">
                    <Input placeholder="Enter city name" />
                </Form.Item>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item label="Min Price" name="min_price">
                            <Input type="number" placeholder="0" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="Max Price" name="max_price">
                            <Input type="number" placeholder="1000000" />
                        </Form.Item>
                    </Col>
                </Row>
            </Form>
        </Drawer>
    );
};

export default AdvancedPropertyFilter;
