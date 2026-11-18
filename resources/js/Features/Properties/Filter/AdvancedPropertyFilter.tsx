import { IModalProps } from "@/Types/common";
import { Drawer, Space, Button, Form, Select, Input, Row, Col } from "antd";
import React from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface Props extends Omit<IModalProps, "onClose"> {
    handleReset: { fn: () => void; loading?: boolean };
    handleSubmit: { fn: () => void; loading?: boolean };
    onClose: () => void;
}

const AdvancedPropertyFilter: React.FC<Props> = ({
    onClose,
    open: filterDrawerVisible,
    handleReset: { fn: handleResetFilters, loading: resetLoading },
    handleSubmit: { fn: handleFilterSubmit, loading: filterLoading },
}) => {
    const { td } = useTd();
    const [form] = Form.useForm();
    const loading = resetLoading || filterLoading;
    return (
        <Drawer
            title={td("Advanced Filters", { source: "en" })}
            placement="right"
            width={400}
            onClose={onClose}
            open={filterDrawerVisible}
            extra={
                <Space>
                    <Button onClick={handleResetFilters} loading={loading}>
                        {td("Reset", { source: "en" })}
                    </Button>
                    <Button
                        type="primary"
                        onClick={() => form.submit()}
                        loading={loading}
                    >
                        {td("Apply Filters", { source: "en" })}
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
                <Form.Item label={td("Property Type", { source: "en" })} name="property_type">
                    <Select
                        placeholder={td("Select property type", { source: "en" })}
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

                <Form.Item label={td("Sale Type", { source: "en" })} name="sale_type">
                    <Select
                        placeholder={td("Select sale type", { source: "en" })}
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

                <Form.Item label={td("Status", { source: "en" })} name="status">
                    <Select
                        placeholder={td("Select status", { source: "en" })}
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

                <Form.Item label={td("City", { source: "en" })} name="city">
                    <Input placeholder={td("Enter city name", { source: "en" })} />
                </Form.Item>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item label={td("Min Price", { source: "en" })} name="min_price">
                            <Input type="number" placeholder="0" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label={td("Max Price", { source: "en" })} name="max_price">
                            <Input type="number" placeholder="1000000" />
                        </Form.Item>
                    </Col>
                </Row>
            </Form>
        </Drawer>
    );
};

export default AdvancedPropertyFilter;
