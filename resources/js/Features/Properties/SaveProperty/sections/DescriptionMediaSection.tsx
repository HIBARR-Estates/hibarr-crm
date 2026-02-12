import React from "react";
import { Form, Input, Row, Col } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory } from "@/Types";

const { TextArea } = Input;

interface DescriptionMediaSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
}

const DescriptionMediaSection: React.FC<DescriptionMediaSectionProps> = ({
    form,
    primaryCategory,
}) => {
    return (
        <Row gutter={[16, 0]}>
            {/* Description */}
            <Col span={24}>
                <Form.Item name="description" label="Description">
                    <TextArea
                        rows={4}
                        placeholder="Enter a detailed property description..."
                        showCount
                        maxLength={5000}
                    />
                </Form.Item>
            </Col>

            {/* Video URL */}
            <Col xs={24} md={12}>
                <Form.Item
                    name="video_url"
                    label="Video URL"
                    rules={[
                        { type: "url", message: "Please enter a valid URL" },
                    ]}
                >
                    <Input placeholder="https://youtube.com/watch?v=..." />
                </Form.Item>
            </Col>

            {/* 360 Tour URL */}
            <Col xs={24} md={12}>
                <Form.Item
                    name="tour_360_url"
                    label="360° Tour URL"
                    rules={[
                        { type: "url", message: "Please enter a valid URL" },
                    ]}
                >
                    <Input placeholder="https://my.matterport.com/show/..." />
                </Form.Item>
            </Col>
        </Row>
    );
};

export default DescriptionMediaSection;
