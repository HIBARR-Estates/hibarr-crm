import { Modal, Form, Input, Button, ColorPicker, Space, Alert } from "antd";
import { PipelineStage } from "@/Types/api/deals";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import React, { useEffect } from "react";
import { EditOutlined } from "@ant-design/icons";
import { ApiResponse } from "@/lib/api/types";
import { useApiMutate } from "@/lib/api/client";
import { isLoading } from "@/lib/utils";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface Props extends IModalProps {
    stage?: PipelineStage;
}

interface EditStageFormData {
    name: string;
    label_color: string;
}

const EditColumn: React.FC<Props> = ({ stage, onClose, open }) => {
    const { td } = useTd();
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
                    {td("Edit Stage", { source: "en" })}
                </Space>
            }
            open={open}
            onCancel={handleCancel}
            width={600}
            footer={null}
            destroyOnClose
        >
            <Alert
                message={td("Note: Changes to the stage will affect all deals currently in this stage.", { source: "en" })}
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
                    label={td("Stage Name", { source: "en" })}
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
                    <Input placeholder={td("Enter stage name", { source: "en" })} size="large" />
                </Form.Item>

                <Form.Item
                    label={td("Label Color", { source: "en" })}
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
                                label: td("Recommended", { source: "en" }),
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
                            {td("Cancel", { source: "en" })}
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            size="large"
                            loading={isLoading({ status })}
                            icon={<EditOutlined />}
                        >
                            {td("Update Stage", { source: "en" })}
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default EditColumn;
