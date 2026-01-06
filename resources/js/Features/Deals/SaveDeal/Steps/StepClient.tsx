import React, { useEffect, useState } from "react";
import { Form, Input, Select, Button, Row, Col, Card } from "antd";
import { UserOutlined, MailOutlined, PhoneOutlined } from "@ant-design/icons";

interface StepClientProps {
    form: any;
    leadContacts: any[];
    onLeadSelect: (leadId: number | null) => void;
    selectedLeadId?: number;
}

const StepClient: React.FC<StepClientProps> = ({
    form,
    leadContacts,
    onLeadSelect,
    selectedLeadId,
}) => {
    const [isDisabled, setIsDisabled] = useState(false);

    useEffect(() => {
        if (selectedLeadId) {
            setIsDisabled(true);
            const lead = leadContacts.find((l) => l.id === selectedLeadId);
            if (lead) {
                form.setFieldsValue({
                    client_name: lead.client_name,
                    client_email: lead.client_email,
                    mobile: lead.mobile,
                });
            }
        } else {
            setIsDisabled(false);
            // Only clear if we are explicitly clearing selection,
            // but we might want to keep typed values if user just cleared the search but didn't select anything yet?
            // The prompt says: "If selection is cleared... Inputs revert to enabled... User can create a new lead"
        }
    }, [selectedLeadId, leadContacts, form]);

    const handleSearchChange = (value: number | undefined) => {
        if (value) {
            onLeadSelect(value);
        } else {
            onLeadSelect(null);
            form.setFieldsValue({
                client_name: undefined,
                client_email: undefined,
                mobile: undefined,
            });
        }
    };

    return (
        <div className="step-client">
            <div className="flex justify-end items-center mb-4">
                <div style={{ width: 300 }}>
                    <Form.Item name="lead_contact" noStyle>
                        <Select
                            showSearch
                            placeholder="Search existing leads..."
                            optionFilterProp="children"
                            onChange={handleSearchChange}
                            allowClear
                            style={{ width: "100%" }}
                            filterOption={(input, option) =>
                                (option?.label ?? "")
                                    .toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                            options={leadContacts.map((contact) => ({
                                value: contact.id,
                                label:
                                    contact.client_name_salutation ||
                                    contact.client_name,
                            }))}
                        />
                    </Form.Item>
                </div>
            </div>

            <Row gutter={16}>
                <Col span={24}>
                    <Form.Item
                        name="client_name"
                        label="Client Name"
                        rules={[
                            {
                                required: !selectedLeadId,
                                message: "Client Name is required",
                            },
                        ]}
                    >
                        <Input
                            prefix={<UserOutlined />}
                            disabled={isDisabled}
                            placeholder="Full Name"
                        />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item
                        name="client_email"
                        label="Email"
                        rules={[
                            {
                                required: !selectedLeadId,
                                message: "Email is required",
                            },
                            { type: "email", message: "Invalid email" },
                        ]}
                    >
                        <Input
                            prefix={<MailOutlined />}
                            disabled={isDisabled}
                            placeholder="Email Address"
                        />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item
                        name="mobile"
                        label="Phone Number"
                        rules={[
                            {
                                required: !selectedLeadId,
                                message: "Phone Number is required",
                            },
                        ]}
                    >
                        <Input
                            prefix={<PhoneOutlined />}
                            disabled={isDisabled}
                            placeholder="Phone Number"
                        />
                    </Form.Item>
                </Col>
            </Row>
        </div>
    );
};

export default StepClient;
