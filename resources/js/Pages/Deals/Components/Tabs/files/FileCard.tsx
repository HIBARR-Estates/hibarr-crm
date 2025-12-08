import { DealFile } from "@/Types/api/file";
import {
    App,
    Card,
    Dropdown,
    MenuProps,
    Image,
    Typography,
    Tag,
    Tooltip,
    Space,
    Avatar,
    Divider,
} from "antd";
import {
    MoreOutlined,
    DownloadOutlined,
    DeleteOutlined,
    EyeOutlined,
    InfoCircleOutlined,
    EditOutlined,
    FileTextOutlined,
    FilePdfOutlined,
    FileImageOutlined,
    FileExcelOutlined,
    FileWordOutlined,
    FilePptOutlined,
    FileZipOutlined,
    FileOutlined,
    ClockCircleOutlined,
    DatabaseOutlined,
    UserOutlined,
} from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiResponse } from "@/lib/api/types";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useState } from "react";
import FileDetails from "./FileDetails";
import DeleteFile from "./DeleteFile";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";

dayjs.extend(relativeTime);

const { Text, Title } = Typography;

interface Props {
    file: DealFile;
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
    onFileDeleted?: () => void;
    onFileUpdated?: () => void;
}

interface DeleteResponse {
    message: string;
}

// TODO: Check what is the issue with the canView & canDelete views

const FileCard: React.FC<Props> = ({
    file,
    canView,
    canEdit,
    canDelete,
    onFileDeleted,
    onFileUpdated,
}) => {
    const { action, handleClose, handleAction } =
        useGenericEntityAction<DealFile>();

    const deleteMutation = useApiMutate<
        {},
        DeleteResponse,
        ApiResponse<DeleteResponse>
    >(route("deal-files.destroy", file.id), "DELETE", (response) => {
        if (response?.status === "success" && onFileDeleted) {
            onFileDeleted();
        }
    });
    const getFileTypeInfo = (filename: string) => {
        const extension = filename.split(".").pop()?.toLowerCase() || "file";

        switch (extension) {
            case "pdf":
                return {
                    icon: <FilePdfOutlined />,
                    color: "#ff4d4f",
                    bgColor: "#fff2f0",
                    type: "PDF",
                };
            case "doc":
            case "docx":
                return {
                    icon: <FileWordOutlined />,
                    color: "#1890ff",
                    bgColor: "#f0f5ff",
                    type: "DOC",
                };
            case "xls":
            case "xlsx":
                return {
                    icon: <FileExcelOutlined />,
                    color: "#52c41a",
                    bgColor: "#f6ffed",
                    type: "XLS",
                };
            case "ppt":
            case "pptx":
                return {
                    icon: <FilePptOutlined />,
                    color: "#fa8c16",
                    bgColor: "#fff7e6",
                    type: "PPT",
                };
            case "jpg":
            case "jpeg":
            case "png":
            case "gif":
            case "bmp":
            case "svg":
            case "webp":
                return {
                    icon: <FileImageOutlined />,
                    color: "#722ed1",
                    bgColor: "#f9f0ff",
                    type: extension.toUpperCase(),
                };
            case "zip":
            case "rar":
            case "7z":
                return {
                    icon: <FileZipOutlined />,
                    color: "#fa541c",
                    bgColor: "#fff2e8",
                    type: "ZIP",
                };
            case "txt":
                return {
                    icon: <FileTextOutlined />,
                    color: "#13c2c2",
                    bgColor: "#e6fffb",
                    type: "TXT",
                };
            default:
                return {
                    icon: <FileOutlined />,
                    color: "#8c8c8c",
                    bgColor: "#f5f5f5",
                    type: extension.toUpperCase(),
                };
        }
    };

    const formatFileSize = (bytes: string | number) => {
        const size = parseInt(bytes.toString());
        if (size === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(size) / Math.log(k));
        return parseFloat((size / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const fileTypeInfo = getFileTypeInfo(file.filename);

    const isImage = (filename: string) => {
        const extension = filename.split(".").pop()?.toLowerCase();
        return ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"].includes(
            extension || ""
        );
    };

    const handleView = () => {
        if (isImage(file.filename)) {
            // Ant Design Image component handles image preview automatically
            return;
        } else {
            // For other files, open in new tab
            window.open(file.file_url, "_blank");
        }
    };

    const handleDownload = () => {
        // Use the download route directly
        // const downloadUrl = `/account/deal-files/download/${file.id}`;
        const downloadUrl = route("deal-files.download", file.id);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = file.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDelete = () => {
        handleAction("delete");
    };

    const handleShowDetails = () => {
        handleAction("view");
    };

    const handleFileUpdated = () => {
        handleClose();
        if (onFileUpdated) {
            onFileUpdated();
        }
    };

    const menuItems: MenuProps["items"] = [
        // ...(canView
        //     ? [
        //           {
        //               key: "view",
        //               label: (
        //                   <Space>
        //                       <EyeOutlined />
        //                       <Text>View</Text>
        //                   </Space>
        //               ),
        //               onClick: () => {
        //                   if (!isImage(file.filename)) {
        //                       handleView();
        //                   }
        //               },
        //           },
        //       ]
        //     : []),
        {
            key: "download",
            label: (
                <Space>
                    <DownloadOutlined />
                    <Text>Download</Text>
                </Space>
            ),
            onClick: handleDownload,
        },
        {
            key: "details",
            label: (
                <Space>
                    <InfoCircleOutlined />
                    <Text>Details</Text>
                </Space>
            ),
            onClick: handleShowDetails,
        },
        ...(canEdit
            ? [
                  {
                      key: "edit",
                      label: (
                          <Space>
                              <EditOutlined />
                              <Text>Edit Description</Text>
                          </Space>
                      ),
                      onClick: handleShowDetails,
                  },
              ]
            : []),
        // ...(canDelete
        //     ? [
        {
            type: "divider" as const,
        },
        {
            key: "delete",
            label: (
                <Space>
                    <DeleteOutlined />
                    <Text>Delete</Text>
                </Space>
            ),
            danger: true,
            onClick: handleDelete,
        },
        //   ]
        // : []),
        // ...(canDelete
        //     ? [
        //           {
        //               type: "divider" as const,
        //           },
        //           {
        //               key: "delete",
        //               label: (
        //                   <Space>
        //                       <DeleteOutlined />
        //                       <Text type="danger">Delete</Text>
        //                   </Space>
        //               ),
        //               danger: true,
        //               onClick: handleDelete,
        //           },
        //       ]
        //     : []),
    ];

    return (
        <div
            className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer group h-full flex flex-col"
            style={{ minHeight: "100px" }}
        >
            {/* File Header with Icon and Info */}
            <div className="flex items-start gap-3 mb-2">
                {isImage(file.filename) ? (
                    <div className="flex-shrink-0">
                        <Image
                            width={40}
                            height={40}
                            src={file.file_url}
                            alt={file.filename}
                            preview={{
                                mask: (
                                    <div className="text-white text-center">
                                        <EyeOutlined className="text-sm" />
                                    </div>
                                ),
                            }}
                            style={{
                                objectFit: "cover",
                                borderRadius: "6px",
                            }}
                            className="shadow-sm border border-gray-200"
                            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnH8W+VtFrtWjubiA"
                        />
                    </div>
                ) : (
                    <div
                        className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
                        style={{
                            backgroundColor: fileTypeInfo.bgColor,
                            border: `1px solid ${fileTypeInfo.color}20`,
                        }}
                    >
                        <div
                            className="text-lg"
                            style={{ color: fileTypeInfo.color }}
                        >
                            {fileTypeInfo.icon}
                        </div>
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <Tooltip title={file.filename}>
                        <Text
                            strong
                            className="block text-sm leading-tight"
                            ellipsis={{ tooltip: file.filename }}
                        >
                            {file.filename}
                        </Text>
                    </Tooltip>
                    <div className="flex items-center gap-2 mt-1">
                        <Tag
                            color={fileTypeInfo.color}
                            className="text-xs px-1 py-0"
                        >
                            {fileTypeInfo.type}
                        </Tag>
                        <Text type="secondary" className="text-xs">
                            {formatFileSize(file.size)}
                        </Text>
                    </div>
                </div>
            </div>

            {/* Timestamp and Actions */}
            <div className="flex items-center justify-between mt-auto pt-1">
                <Tooltip title="Details">
                    <button
                        className="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleShowDetails();
                        }}
                    >
                        <InfoCircleOutlined className="text-gray-600 text-sm" />
                    </button>
                </Tooltip>
                <Space size="small">
                    {/* {canView && (
                        <Tooltip title="View">
                            <button
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isImage(file.filename)) {
                                        handleView();
                                    }
                                }}
                            >
                                <EyeOutlined className="text-gray-600 text-sm" />
                            </button>
                        </Tooltip>
                    )} */}
                    <Tooltip title="Download">
                        <button
                            className="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDownload();
                            }}
                        >
                            <DownloadOutlined className="text-gray-600 text-sm" />
                        </button>
                    </Tooltip>

                    <Dropdown
                        menu={{ items: menuItems }}
                        trigger={["click"]}
                        placement="bottomRight"
                    >
                        <button
                            className="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MoreOutlined className="text-gray-600 text-sm" />
                        </button>
                    </Dropdown>
                </Space>
            </div>

            {/* File Details Modal */}
            <FileDetails
                file={file}
                canEdit={canEdit}
                open={action === "view"}
                onClose={() => handleClose()}
                onFileUpdated={handleFileUpdated}
            />
            <DeleteFile
                file={file}
                open={action === "delete"}
                onClose={() => handleClose()}
                onSuccess={handleFileUpdated}
            />
        </div>
    );
};

export default FileCard;
