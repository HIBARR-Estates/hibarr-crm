import { DealFile } from "@/Types/api/file";
import { Card, Dropdown, MenuProps, message, Modal } from "antd";
import {
    MoreOutlined,
    DownloadOutlined,
    DeleteOutlined,
    EyeOutlined,
    FileTextOutlined,
    FilePdfOutlined,
    FileImageOutlined,
    FileExcelOutlined,
    FileWordOutlined,
    FilePptOutlined,
    FileZipOutlined,
    FileOutlined,
} from "@ant-design/icons";
import { router } from "@inertiajs/react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface Props {
    file: DealFile;
    canView: boolean;
    canDelete: boolean;
    onFileDeleted?: () => void;
}

const FileCard: React.FC<Props> = ({
    file,
    canView,
    canDelete,
    onFileDeleted,
}) => {
    const getFileIcon = (filename: string) => {
        const extension = filename.split(".").pop()?.toLowerCase();
        const iconProps = { style: { fontSize: "48px", color: "#1890ff" } };

        switch (extension) {
            case "pdf":
                return (
                    <FilePdfOutlined
                        {...iconProps}
                        style={{ ...iconProps.style, color: "#ff4d4f" }}
                    />
                );
            case "doc":
            case "docx":
                return (
                    <FileWordOutlined
                        {...iconProps}
                        style={{ ...iconProps.style, color: "#1890ff" }}
                    />
                );
            case "xls":
            case "xlsx":
                return (
                    <FileExcelOutlined
                        {...iconProps}
                        style={{ ...iconProps.style, color: "#52c41a" }}
                    />
                );
            case "ppt":
            case "pptx":
                return (
                    <FilePptOutlined
                        {...iconProps}
                        style={{ ...iconProps.style, color: "#fa8c16" }}
                    />
                );
            case "jpg":
            case "jpeg":
            case "png":
            case "gif":
            case "bmp":
            case "svg":
                return (
                    <FileImageOutlined
                        {...iconProps}
                        style={{ ...iconProps.style, color: "#722ed1" }}
                    />
                );
            case "zip":
            case "rar":
            case "7z":
                return (
                    <FileZipOutlined
                        {...iconProps}
                        style={{ ...iconProps.style, color: "#fa541c" }}
                    />
                );
            case "txt":
                return <FileTextOutlined {...iconProps} />;
            default:
                return <FileOutlined {...iconProps} />;
        }
    };

    const isImage = (filename: string) => {
        const extension = filename.split(".").pop()?.toLowerCase();
        return ["jpg", "jpeg", "png", "gif", "bmp", "svg"].includes(
            extension || ""
        );
    };

    const handleView = () => {
        if (isImage(file.filename)) {
            // For images, show in modal
            Modal.info({
                title: file.filename,
                width: 800,
                content: (
                    <div className="text-center">
                        <img
                            src={file.file_url}
                            alt={file.filename}
                            style={{
                                maxWidth: "100%",
                                maxHeight: "70vh",
                                objectFit: "contain",
                            }}
                        />
                    </div>
                ),
                footer: null,
            });
        } else {
            // For other files, open in new tab
            window.open(file.file_url, "_blank");
        }
    };

    const handleDownload = () => {
        window.location.href = route("deal-files.download", file.id);
    };

    const handleDelete = () => {
        Modal.confirm({
            title: "Delete File",
            content: `Are you sure you want to delete "${file.filename}"? This action cannot be undone.`,
            okText: "Yes, Delete",
            okType: "danger",
            cancelText: "Cancel",
            onOk: () => {
                router.delete(route("deal-files.destroy", file.id), {
                    onSuccess: () => {
                        message.success("File deleted successfully");
                        router.reload();
                        if (onFileDeleted) {
                            onFileDeleted();
                        }
                    },
                    onError: () => {
                        message.error("Failed to delete file");
                    },
                });
            },
        });
    };

    const menuItems: MenuProps["items"] = [
        ...(canView
            ? [
                  {
                      key: "view",
                      label: "View",
                      icon: <EyeOutlined />,
                      onClick: handleView,
                  },
              ]
            : []),
        {
            key: "download",
            label: "Download",
            icon: <DownloadOutlined />,
            onClick: handleDownload,
        },
        ...(canDelete
            ? [
                  {
                      type: "divider" as const,
                  },
                  {
                      key: "delete",
                      label: "Delete",
                      icon: <DeleteOutlined />,
                      danger: true,
                      onClick: handleDelete,
                  },
              ]
            : []),
    ];

    return (
        <Card
            className="file-card h-full hover:shadow-md transition-shadow"
            cover={
                <div className="flex justify-center items-center py-8 bg-gray-50">
                    {isImage(file.filename) ? (
                        <div className="w-24 h-24 overflow-hidden rounded">
                            <img
                                src={file.file_url}
                                alt={file.filename}
                                className="w-full h-full object-cover cursor-pointer"
                                onClick={canView ? handleView : undefined}
                            />
                        </div>
                    ) : (
                        <div
                            className="cursor-pointer"
                            onClick={canView ? handleView : undefined}
                        >
                            {getFileIcon(file.filename)}
                        </div>
                    )}
                </div>
            }
            actions={[
                <Dropdown
                    key="more"
                    menu={{ items: menuItems }}
                    trigger={["click"]}
                    placement="bottomRight"
                >
                    <button className="p-2 hover:bg-gray-100 rounded transition-colors">
                        <MoreOutlined className="text-lg" />
                    </button>
                </Dropdown>,
            ]}
        >
            <Card.Meta
                title={
                    <div className="truncate" title={file.filename}>
                        {file.filename}
                    </div>
                }
                description={
                    <div className="text-xs text-gray-500">
                        <div>Added {dayjs(file.created_at).fromNow()}</div>
                        <div className="mt-1">
                            Size:{" "}
                            {(parseInt(file.size) / 1024 / 1024).toFixed(2)} MB
                        </div>
                    </div>
                }
            />
        </Card>
    );
};

export default FileCard;
