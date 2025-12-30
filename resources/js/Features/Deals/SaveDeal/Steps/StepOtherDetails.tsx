import React from "react";
import { Form, Input, Select, DatePicker, Switch, Row, Col } from "antd";

interface StepOtherDetailsProps {
    form: any;
    categories: any[];
    employees: any[];
}

const StepOtherDetails: React.FC<StepOtherDetailsProps> = ({
    form,
    categories,
    employees,
}) => {
    return (
        <div className="step-other-details">
            <h4 className="text-lg font-medium mb-4">Other Deal Details</h4>
            <Row gutter={16}>
                <Col span={24}>
                    <Form.Item
                        name="name"
                        label="Deal Name"
                        tooltip="Auto-generated based on client name"
                    >
                        <Input placeholder="Deal Name" readOnly />
                    </Form.Item>
                </Col>

                <Col span={12}>
                    <Form.Item name="category_id" label="Category">
                        <Select placeholder="Select Category" allowClear>
                            {categories.map((category) => (
                                <Select.Option key={category.id} value={category.id}>
                                    {category.category_name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col span={12}>
                    <Form.Item name="close_date" label="Expected Close Date">
                        <DatePicker style={{ width: "100%" }} />
                    </Form.Item>
                </Col>

                <Col span={24}>
                    <Form.Item name="deal_watcher" label="Deal Watchers">
                        <Select
                            mode="multiple"
                            placeholder="Select Watchers"
                            optionFilterProp="children"
                        >
                            {employees.map((emp) => (
                                <Select.Option key={emp.id} value={emp.id}>
                                    <div className="flex items-center">
                                        <img
                                            src={emp.image_url}
                                            alt={emp.name}
                                            className="w-5 h-5 rounded-full mr-2"
                                        />
                                        {emp.name}
                                    </div>
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col span={12}>
                    <Form.Item
                        name="strategy_accepted"
                        label="Strategy Accepted"
                        valuePropName="checked"
                    >
                        <Switch />
                    </Form.Item>
                </Col>

                <Col span={12}>
                    <Form.Item
                        name="downpayment_confirmed"
                        label="Downpayment Confirmed"
                        valuePropName="checked"
                    >
                        <Switch />
                    </Form.Item>
                </Col>
            </Row>
        </div>
    );
};

export default StepOtherDetails;
