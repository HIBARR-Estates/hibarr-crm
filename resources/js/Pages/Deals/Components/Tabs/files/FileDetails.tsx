import { DealFile } from "@/Types/api/file";
import { IModalProps } from "@/Types/common";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { Modal, Form, Input, Button, Descriptions, Typography } from "antd";
import { EditOutlined, SaveOutlined, EyeOutlined } from "@ant-design/icons";
import { useState } from "react";
import { ApiResponse } from "@/lib/api/types";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Props extends IModalProps {
    file: DealFile;
    canEdit: boolean;
    onFileUpdated?: () => void;
}

interface FileUpdateData {
    description: string;
}

interface FileUpdateResponse {
    message: string;
}

const FileDetails: React.FC<Props> = ({
    file,
    canEdit,
    open,
    onClose,
    onFileUpdated,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [form] = Form.useForm();

    const updateMutation = useApiMutate<
        FileUpdateData,
        FileUpdateResponse,
        ApiResponse<FileUpdateResponse>
    >(route("deal-files.update", file.id), "PUT", (response) => {
        if (response?.status === "success") {
            setIsEditing(false);
            onClose();
            if (onFileUpdated) {
                onFileUpdated();
            }
        }
    });

    const handleEdit = () => {
        setIsEditing(true);
        form.setFieldsValue({
            description: file.description || "",
        });
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            updateMutation.mutate(values);
        } catch (error) {
            console.error("Validation failed:", error);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        form.resetFields();
    };

    const formatFileSize = (bytes: string | number) => {
        const size = typeof bytes === "string" ? parseInt(bytes) : bytes;
        return (size / 1024 / 1024).toFixed(2) + " MB";
    };

    return (
        <Modal
            title={
                <div className="flex items-center space-x-2">
                    <EyeOutlined />
                    <span>File Details</span>
                </div>
            }
            open={open}
            onCancel={() => onClose()}
            width={600}
            footer={
                isEditing
                    ? [
                          <Button
                              key="cancel"
                              onClick={handleCancel}
                              disabled={updateMutation.isPending}
                          >
                              Cancel
                          </Button>,
                          <Button
                              key="save"
                              type="primary"
                              icon={<SaveOutlined />}
                              loading={updateMutation.isPending}
                              onClick={handleSave}
                          >
                              Save Changes
                          </Button>,
                      ]
                    : [
                          <Button key="close" onClick={() => onClose()}>
                              Close
                          </Button>,
                          ...(canEdit
                              ? [
                                    <Button
                                        key="edit"
                                        type="primary"
                                        icon={<EditOutlined />}
                                        onClick={handleEdit}
                                    >
                                        Edit Description
                                    </Button>,
                                ]
                              : []),
                      ]
            }
        >
            <div className="space-y-4">
                <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="File Name">
                        <Text strong>{file.filename}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="File Size">
                        {formatFileSize(file.size)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Uploaded">
                        {dayjs(file.created_at).format(
                            "MMMM DD, YYYY [at] h:mm A"
                        )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Last Modified">
                        {dayjs(file.updated_at).format(
                            "MMMM DD, YYYY [at] h:mm A"
                        )}
                    </Descriptions.Item>
                </Descriptions>

                <div>
                    <Title level={5}>Description</Title>
                    {isEditing ? (
                        <Form form={form} layout="vertical">
                            <Form.Item
                                name="description"
                                rules={[
                                    {
                                        max: 500,
                                        message:
                                            "Description cannot exceed 500 characters",
                                    },
                                ]}
                            >
                                <TextArea
                                    rows={4}
                                    placeholder="Enter file description..."
                                    showCount
                                    maxLength={500}
                                />
                            </Form.Item>
                        </Form>
                    ) : (
                        <div className="p-3 bg-gray-50 rounded border border-gray-200 min-h-[100px]">
                            {file.description ? (
                                <Text>{file.description}</Text>
                            ) : (
                                <Text type="secondary" italic>
                                    No description provided
                                </Text>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default FileDetails;
