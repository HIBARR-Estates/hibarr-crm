import { useState } from "react";
import { Modal, Form, Input, Button, ColorPicker } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse, isSuccessResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import { errorFormatter } from "@/lib/api/utils/common";
import { useTd } from "@/Hooks/useDynamicTranslation";

const { TextArea } = Input;

interface MeetingTypeFormData {
    name: string;
    description?: string;
    color: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess?: (meetingType: {
        id: number;
        name: string;
        description?: string;
        color: string;
    }) => void;
}

export default function AddMeetingType({ open, onClose, onSuccess }: Props) {
    const { td } = useTd();
    const [form] = Form.useForm();
    const [formData, setFormData] = useState<MeetingTypeFormData>({
        name: "",
        color: "#1890ff",
    });
    const [errors, setErrors] = useState<string[]>([]);

    const { mutate: saveMeetingType, status } = useApiMutate<
        MeetingTypeFormData,
        {
            meeting_type: {
                id: number;
                name: string;
                description?: string;
                color: string;
            };
        },
        ApiResponse<{
            meeting_type: {
                id: number;
                name: string;
                description?: string;
                color: string;
            };
        }>
    >(route("meeting-types.store"), "POST", () => {
        // Success callback will be handled in onSubmit
    });

    const handleSubmit = (values: any) => {
        const submitData = {
            name: values.name,
            description: values.description || "",
            color:
                typeof values.color === "string"
                    ? values.color
                    : values.color.toHexString(),
        };

        saveMeetingType(submitData, {
            onSuccess: (data) => {
                form.resetFields();
                setFormData({ name: "", color: "#1890ff" });
                setErrors([]);
                if (isSuccessResponse(data) && data.data?.meeting_type) {
                    onSuccess?.(data.data.meeting_type);
                }
                onClose();
            },
            onError: (errorResponse) => {
                const responseErrors =
                    errorFormatter(errorResponse)?.errors || [];
                setErrors(Object.values(responseErrors).flat());
            },
        });
    };

    const handleCancel = () => {
        form.resetFields();
        setFormData({ name: "", color: "#1890ff" });
        setErrors([]);
        onClose();
    };

    const loading = isLoading({ status });

    return (
        <Modal
            title={td("Add New Meeting Type", { source: "en" })}
            open={open}
            onCancel={handleCancel}
            footer={null}
            width={500}
            destroyOnClose
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                className="mt-4"
                initialValues={{
                    color: "#1890ff",
                }}
            >
                {/* Display errors if any */}
                {errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                        {errors.map((error: string, index: number) => (
                            <p
                                key={index}
                                className="text-red-600 text-sm mb-0"
                            >
                                {error}
                            </p>
                        ))}
                    </div>
                )}

                <Form.Item
                    label={td("Meeting Type Name", { source: "en" })}
                    name="name"
                    rules={[
                        {
                            required: true,
                            message: "Please enter a meeting type name",
                        },
                        {
                            min: 2,
                            message:
                                "Meeting type name must be at least 2 characters",
                        },
                        {
                            max: 50,
                            message:
                                "Meeting type name cannot exceed 50 characters",
                        },
                    ]}
                >
                    <Input
                        placeholder={td("e.g., Client Meeting, Follow-up Call, Demo", { source: "en" })}
                        disabled={loading}
                        autoFocus
                    />
                </Form.Item>

                <Form.Item
                    label={td("Description (Optional)", { source: "en" })}
                    name="description"
                    rules={[
                        {
                            max: 255,
                            message: "Description cannot exceed 255 characters",
                        },
                    ]}
                >
                    <TextArea
                        placeholder={td("Brief description of this meeting type...", { source: "en" })}
                        disabled={loading}
                        rows={3}
                        maxLength={255}
                        showCount
                    />
                </Form.Item>

                <Form.Item
                    label={td("Color", { source: "en" })}
                    name="color"
                    rules={[
                        {
                            required: true,
                            message: "Please select a color",
                        },
                    ]}
                >
                    <ColorPicker
                        disabled={loading}
                        showText
                        format="hex"
                        presets={[
                            {
                                label: td("Recommended", { source: "en" }),
                                colors: [
                                    "#f50",
                                    "#2db7f5",
                                    "#87d068",
                                    "#108ee9",
                                    "#722ed1",
                                    "#eb2f96",
                                    "#fa541c",
                                    "#13c2c2",
                                    "#52c41a",
                                    "#1890ff",
                                ],
                            },
                        ]}
                    />
                </Form.Item>

                <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                    <Button onClick={handleCancel} disabled={loading}>
                        {td("Cancel", { source: "en" })}
                    </Button>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={loading}
                        icon={<SaveOutlined />}
                    >
                        {td("Add Meeting Type", { source: "en" })}
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}
