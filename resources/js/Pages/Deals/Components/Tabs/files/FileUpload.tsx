import { Deal } from "@/Types/api/deals";
import { IModalProps } from "@/Types/common";
import { useFormDataMutate } from "@/lib/api/client/useFormDataMutate";
import { Modal, Upload, Button } from "antd";
import { InboxOutlined, UploadOutlined } from "@ant-design/icons";
import { useState } from "react";
import type { UploadProps, UploadFile } from "antd";
import { ApiResponse } from "@/lib/api/types";

const { Dragger } = Upload;

interface Props extends IModalProps {
    deal: Deal;
    onFileUploaded?: () => void;
}

interface FileUploadResponse {
    message: string;
}

const FileUpload: React.FC<Props> = ({
    deal,
    onClose,
    open,
    onFileUploaded,
}) => {
    const [fileList, setFileList] = useState<UploadFile[]>([]);

    const uploadMutation = useFormDataMutate<
        FileUploadResponse,
        ApiResponse<FileUploadResponse>
    >(route("deal-files.store"), "POST", (response) => {
        if (response?.status === "success") {
            setFileList([]);
            onClose();
            if (onFileUploaded) {
                onFileUploaded();
            }
        }
    });

    const uploadProps: UploadProps = {
        name: "file",
        multiple: true,
        fileList,
        beforeUpload: (file) => {
            // Add file to list but don't auto upload
            setFileList((prev) => [...prev, file]);
            return false; // Prevent auto upload
        },
        onRemove: (file) => {
            setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
        },
        showUploadList: {
            showRemoveIcon: true,
            removeIcon: "Remove",
        },
    };

    const handleUpload = async () => {
        if (fileList.length === 0) {
            return;
        }

        const formData = new FormData();
        fileList.forEach((file) => {
            formData.append("file[]", file as any);
        });
        formData.append("lead_id", deal.id.toString());

        uploadMutation.mutate(formData);
    };

    const handleCancel = () => {
        setFileList([]);
        onClose();
    };

    return (
        <Modal
            title="Upload Files"
            open={open}
            onCancel={handleCancel}
            footer={[
                <Button
                    key="cancel"
                    onClick={handleCancel}
                    disabled={uploadMutation.isPending}
                >
                    Cancel
                </Button>,
                <Button
                    key="upload"
                    type="primary"
                    icon={<UploadOutlined />}
                    loading={uploadMutation.isPending}
                    onClick={handleUpload}
                    disabled={fileList.length === 0}
                >
                    {uploadMutation.isPending ? "Uploading..." : "Upload Files"}
                </Button>,
            ]}
            destroyOnClose
            width={600}
        >
            <div className="mb-4">
                <Dragger {...uploadProps} className="upload-dragger">
                    <p className="ant-upload-drag-icon">
                        <InboxOutlined
                            style={{ fontSize: "48px", color: "#1890ff" }}
                        />
                    </p>
                    <p className="ant-upload-text text-lg font-medium">
                        Click or drag files to this area to upload
                    </p>
                    <p className="ant-upload-hint text-gray-500">
                        Support for multiple files. You can select multiple
                        files at once.
                    </p>
                </Dragger>
            </div>

            {fileList.length > 0 && (
                <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Selected Files ({fileList.length})
                    </h4>
                    <div className="max-h-32 overflow-y-auto">
                        {fileList.map((file, index) => (
                            <div
                                key={file.uid}
                                className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded mb-1"
                            >
                                <span className="text-sm truncate">
                                    {file.name}
                                </span>
                                <span className="text-xs text-gray-500 ml-2">
                                    {(file.size! / 1024 / 1024).toFixed(2)} MB
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default FileUpload;
