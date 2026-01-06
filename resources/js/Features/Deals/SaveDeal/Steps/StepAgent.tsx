import React, { useEffect, useState } from "react";
import { Form, Input, Select, Row, Col } from "antd";
import {
    UserOutlined,
    MailOutlined,
    PhoneOutlined,
    TeamOutlined,
} from "@ant-design/icons";

interface StepAgentProps {
    form: any;
    leadAgents: any[];
    onAgentSelect: (agentId: number | null) => void;
    selectedAgentId?: number;
}

const StepAgent: React.FC<StepAgentProps> = ({
    form,
    leadAgents,
    onAgentSelect,
    selectedAgentId,
}) => {
    const [isDisabled, setIsDisabled] = useState(false);

    useEffect(() => {
        if (selectedAgentId) {
            setIsDisabled(true);
            const agent = leadAgents.find((a) => a.id === selectedAgentId);
            if (agent && agent.user) {
                form.setFieldsValue({
                    agent_name: agent.user.name,
                    agent_email: agent.user.email,
                    agent_mobile: agent.user.mobile,
                    // referral? Agent model might not have it on user.
                });
            }
        } else {
            setIsDisabled(false);
        }
    }, [selectedAgentId, leadAgents, form]);

    const handleSearchChange = (value: number | undefined) => {
        if (value) {
            onAgentSelect(value);
        } else {
            onAgentSelect(null);
            form.setFieldsValue({
                agent_name: undefined,
                agent_email: undefined,
                agent_mobile: undefined,
                agent_referral: undefined,
            });
        }
    };

    return (
        <div className="step-agent">
            <div className="flex justify-end items-center mb-4">
                <div style={{ width: 300 }}>
                    <Form.Item name="agent_id" noStyle>
                        <Select
                            showSearch
                            placeholder="Search existing agents..."
                            optionFilterProp="children"
                            onChange={handleSearchChange}
                            allowClear
                            style={{ width: "100%" }}
                            filterOption={(input, option) =>
                                (option?.label ?? "")
                                    .toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                            options={leadAgents.map((agent) => ({
                                value: agent.id,
                                label: agent.user?.name || `Agent #${agent.id}`,
                            }))}
                        />
                    </Form.Item>
                </div>
            </div>

            <Row gutter={16}>
                <Col span={24}>
                    <Form.Item name="agent_name" label="Agent Name">
                        <Input
                            prefix={<UserOutlined />}
                            disabled={isDisabled}
                            placeholder="Agent Name"
                        />
                    </Form.Item>
                </Col>
                <Col span={24}>
                    <Form.Item
                        name="agent_referral"
                        label="Referral"
                        tooltip="Who referred this agent?"
                    >
                        <Input
                            prefix={<TeamOutlined />}
                            disabled={isDisabled}
                            placeholder="Referral Source"
                        />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item name="agent_email" label="Email">
                        <Input
                            prefix={<MailOutlined />}
                            disabled={isDisabled}
                            placeholder="Email Address"
                        />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item name="agent_mobile" label="Phone Number">
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

export default StepAgent;
