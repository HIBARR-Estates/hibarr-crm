import { Modal, Form, Input, Button, ColorPicker, Space, Alert } from "antd";
import { PipelineStage } from "@/Types/api/deals";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import React, { useEffect } from "react";
import { EditOutlined } from "@ant-design/icons";
import { ApiResponse } from "@/lib/api/types";
import { useApiMutate } from "@/lib/api/client";
import { isLoading } from "@/lib/utils";

interface Props extends IModalProps {
    stage?: PipelineStage;
}

interface EditStageFormData {
    name: string;
    label_color: string;
}

const EditColumn: React.FC<Props> = ({ stage, onClose, open }) => {
    const [form] = Form.useForm<EditStageFormData>();

    const { mutate, status } = useApiMutate<
        EditStageFormData,
        null,
        ApiResponse<null>
    >(
        route("lead-stage-setting.update", {
            lead_stage_setting: Number(stage?.id),
        }),
        "PUT",
        () => {
            handleCancel();
        }
    );

    useEffect(() => {
        if (open && stage) {
            form.setFieldsValue({
                name: stage.name || "",
                label_color: stage.label_color || "#1677ff",
            });
        }
    }, [open, stage, form]);

    const handleCancel = () => {
        form.resetFields();
        onClose();
    };

    const onSubmit = (values: EditStageFormData) => {
        mutate(values, {
            onSuccess: () => {
                console.log("Stage was updated successfully...");
                router.reload();
            },
        });
    };

    const handleColorChange = (color: any) => {
        form.setFieldValue("label_color", color.toHexString());
    };

    return (
        <Modal
            title={
                <Space>
                    <EditOutlined className="text-blue-500" />
                    Edit Stage
                </Space>
            }
            open={open}
            onCancel={handleCancel}
            width={600}
            footer={null}
            destroyOnClose
        >
            <Alert
                message="Note: Changes to the stage will affect all deals currently in this stage."
                type="info"
                showIcon
                className="mb-4"
            />

            <Form
                form={form}
                layout="vertical"
                onFinish={onSubmit}
                autoComplete="off"
            >
                <Form.Item
                    label="Stage Name"
                    name="name"
                    rules={[
                        {
                            required: true,
                            message: "Please enter the stage name",
                        },
                        {
                            min: 2,
                            message: "Stage name must be at least 2 characters",
                        },
                        {
                            max: 50,
                            message: "Stage name cannot exceed 50 characters",
                        },
                    ]}
                >
                    <Input placeholder="Enter stage name" size="large" />
                </Form.Item>

                <Form.Item
                    label="Label Color"
                    name="label_color"
                    rules={[
                        {
                            required: true,
                            message: "Please select a label color",
                        },
                    ]}
                >
                    <ColorPicker
                        size="large"
                        showText
                        onChange={handleColorChange}
                        presets={[
                            {
                                label: "Recommended",
                                colors: [
                                    "#1677ff", // Blue
                                    "#52c41a", // Green
                                    "#faad14", // Orange
                                    "#f5222d", // Red
                                    "#722ed1", // Purple
                                    "#13c2c2", // Cyan
                                    "#eb2f96", // Magenta
                                    "#fa8c16", // Volcano
                                ],
                            },
                        ]}
                    />
                </Form.Item>

                <Form.Item className="mb-0 mt-6">
                    <Space className="w-full justify-end">
                        <Button onClick={handleCancel} size="large">
                            Cancel
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            size="large"
                            loading={isLoading({ status })}
                            icon={<EditOutlined />}
                        >
                            Update Stage
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default EditColumn;
