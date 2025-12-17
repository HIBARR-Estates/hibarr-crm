import React, { useState } from "react";
import {
    Modal,
    Form,
    Upload,
    Switch,
    Button,
    Space,
    Typography,
    Alert,
} from "antd";
import { UploadOutlined, DownloadOutlined } from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";

const { Title, Text, Link } = Typography;

interface ImportModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (formData: FormData) => void;
    loading?: boolean;
    title?: string;
    sampleDownloadUrl?: string;
    acceptedFileTypes?: string;
    maxFileSize?: number; // in MB
    description?: string;
}

export default function ImportModal({
    visible,
    onClose,
    onSubmit,
    loading = false,
    title = "Import Data",
    sampleDownloadUrl,
    acceptedFileTypes = ".xlsx,.xls,.csv",
    maxFileSize = 10,
    description,
}: ImportModalProps) {
    const [form] = Form.useForm();
    const [hasHeading, setHasHeading] = useState(true);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            if (!values.import_file || values.import_file.length === 0) {
                Modal.error({
                    title: "No File Selected",
                    content: "Please select a file to upload",
                });
                return;
            }

            const file = values.import_file[0].originFileObj;

            const formData = new FormData();
            formData.append("import_file", file);
            if (hasHeading) {
                formData.append("heading", "1");
            }

            onSubmit(formData);
        } catch (error) {
            console.error("Validation failed:", error);
        }
    };

    const handleCancel = () => {
        if (!loading) {
            form.resetFields();
            setHasHeading(true);
            onClose();
        }
    };

    const normFile = (e: any) => {
        if (Array.isArray(e)) {
            return e;
        }
        return e?.fileList;
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <UploadOutlined />
                    <span>{title}</span>
                </div>
            }
            open={visible}
            onCancel={handleCancel}
            footer={[
                <Button key="cancel" onClick={handleCancel} disabled={loading}>
                    Cancel
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    loading={loading}
                    onClick={handleSubmit}
                    disabled={loading}
                    icon={<UploadOutlined />}
                >
                    {loading ? "Importing..." : "Upload & Import"}
                </Button>,
            ]}
            width={600}
            destroyOnHidden
        >
            <div className="space-y-4">
                {description && (
                    <Alert
                        message={description}
                        type="info"
                        showIcon
                        className="mb-4"
                    />
                )}

                {sampleDownloadUrl && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <Title level={5} className="mb-1">
                                    Download Sample Template
                                </Title>
                                <Text type="secondary">
                                    Download the sample file to see the expected
                                    format
                                </Text>
                            </div>
                            <Button
                                type="primary"
                                icon={<DownloadOutlined />}
                                href={sampleDownloadUrl}
                                target="_blank"
                            >
                                Download Sample
                            </Button>
                        </div>
                    </div>
                )}

                <Form form={form} layout="vertical">
                    <Form.Item
                        label="Import File"
                        name="import_file"
                        valuePropName="fileList"
                        getValueFromEvent={normFile}
                        rules={[
                            {
                                required: true,
                                message: "Please select a file to import",
                            },
                        ]}
                        help="Select an Excel file (.xlsx, .xls) to import data"
                    >
                        <Upload.Dragger
                            beforeUpload={(file) => {
                                const isValidType = acceptedFileTypes.includes(
                                    file.name.slice(file.name.lastIndexOf("."))
                                );

                                if (!isValidType) {
                                    Modal.error({
                                        title: "Invalid File Type",
                                        content: `Please upload a file with one of these extensions: ${acceptedFileTypes}`,
                                    });
                                    return Upload.LIST_IGNORE;
                                }

                                const isValidSize =
                                    file.size / 1024 / 1024 < maxFileSize;
                                if (!isValidSize) {
                                    Modal.error({
                                        title: "File Too Large",
                                        content: `File size must be smaller than ${maxFileSize}MB`,
                                    });
                                    return Upload.LIST_IGNORE;
                                }

                                return false; // Prevent automatic upload
                            }}
                            maxCount={1}
                        >
                            <p className="ant-upload-drag-icon">
                                <UploadOutlined />
                            </p>
                            <p className="ant-upload-text">
                                Click or drag file to this area to upload
                            </p>
                            <p className="ant-upload-hint">
                                Supported formats: {acceptedFileTypes}. Maximum
                                size: {maxFileSize}MB
                            </p>
                        </Upload.Dragger>
                    </Form.Item>

                    <Form.Item>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={hasHeading}
                                onChange={setHasHeading}
                                size="small"
                            />
                            <Text>File contains column headings</Text>
                        </div>
                        <Text type="secondary" className="text-xs">
                            Check this if your first row contains column names
                        </Text>
                    </Form.Item>
                </Form>

                <Alert
                    message="Import Guidelines"
                    description={
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>
                                Ensure all required fields are included in your
                                file
                            </li>
                            <li>
                                Use the exact column names as shown in the
                                sample template
                            </li>
                            <li>Remove any empty rows before importing</li>
                            <li>Large files may take some time to process</li>
                        </ul>
                    }
                    type="warning"
                    showIcon
                />
            </div>
        </Modal>
    );
}
