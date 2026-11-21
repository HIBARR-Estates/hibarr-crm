import { DealFile } from "@/Types/api/file";
import { IModalProps } from "@/Types/common";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { Modal, Form, Input, Button, Descriptions, Typography } from "antd";
import { EditOutlined, SaveOutlined, EyeOutlined } from "@ant-design/icons";
import { useState } from "react";
import { ApiResponse } from "@/lib/api/types";
import { formatCompanyDateTime } from "@/lib/companyDateTime";
import { useTd } from "@/Hooks/useDynamicTranslation";

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
    const { td } = useTd();
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
                    <span>{td("File Details", { source: "en" })}</span>
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
                              {td("Cancel", { source: "en" })}
                          </Button>,
                          <Button
                              key="save"
                              type="primary"
                              icon={<SaveOutlined />}
                              loading={updateMutation.isPending}
                              onClick={handleSave}
                          >
                              {td("Save Changes", { source: "en" })}
                          </Button>,
                      ]
                    : [
                          <Button key="close" onClick={() => onClose()}>
                              {td("Close", { source: "en" })}
                          </Button>,
                          ...(canEdit
                              ? [
                                    <Button
                                        key="edit"
                                        type="primary"
                                        icon={<EditOutlined />}
                                        onClick={handleEdit}
                                    >
                                        {td("Edit Description", { source: "en" })}
                                    </Button>,
                                ]
                              : []),
                      ]
            }
        >
            <div className="space-y-4">
                <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label={td("File Name", { source: "en" })}>
                        <Text strong>{file.filename}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label={td("File Size", { source: "en" })}>
                        {formatFileSize(file.size)}
                    </Descriptions.Item>
                    <Descriptions.Item label={td("Uploaded", { source: "en" })}>
                        {formatCompanyDateTime(file.created_at, {
                            separator: " at ",
                        })}
                    </Descriptions.Item>
                    <Descriptions.Item label={td("Last Modified", { source: "en" })}>
                        {formatCompanyDateTime(file.updated_at, {
                            separator: " at ",
                        })}
                    </Descriptions.Item>
                </Descriptions>

                <div>
                    <Title level={5}>{td("Description", { source: "en" })}</Title>
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
                                    placeholder={td("Enter file description...", { source: "en" })}
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
                                    {td("No description provided", { source: "en" })}
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
