import React from "react";
import { PropertyAsset } from "@/Types";
import { Image, Tag, Checkbox, Typography, Space } from "antd";
import type { TableColumnsType } from "antd";
import {
    FileImageOutlined,
    VideoCameraOutlined,
    GlobalOutlined,
} from "@ant-design/icons";
import { DataTable } from "@/Components/DataTable";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
import dayjs from "dayjs";

const { Text } = Typography;

interface AssetTableViewProps {
    assets: PropertyAsset[];
    selectedAssets: number[];
    loading?: boolean;
    pagination: {
        current: number;
        pageSize: number;
        total: number;
        onChange: (page: number, pageSize: number) => void;
    };
    onAssetClick: (asset: PropertyAsset) => void;
    onAssetSelect: (assetId: number, checked: boolean) => void;
    onSelectAll: (checked: boolean) => void;
}

const AssetTableView: React.FC<AssetTableViewProps> = ({
    assets,
    selectedAssets,
    loading,
    pagination,
    onAssetClick,
    onAssetSelect,
    onSelectAll,
}) => {
    const getAssetIcon = (assetType: PropertyAsset["asset_type"]) => {
        switch (assetType) {
            case "image":
                return <FileImageOutlined className="text-blue-500" />;
            case "video":
            case "video_url":
                return <VideoCameraOutlined className="text-red-500" />;
            case "tour_360_url":
                return <GlobalOutlined className="text-green-500" />;
            default:
                return <FileImageOutlined />;
        }
    };

    const columns: TableColumnsType<PropertyAsset> = [
        {
            title: (
                <Checkbox
                    checked={
                        assets.length > 0 &&
                        selectedAssets.length === assets.length
                    }
                    indeterminate={
                        selectedAssets.length > 0 &&
                        selectedAssets.length < assets.length
                    }
                    onChange={(e) => onSelectAll(e.target.checked)}
                />
            ),
            key: "selection",
            width: 50,
            render: (_, record) => (
                <Checkbox
                    checked={selectedAssets.includes(record.id)}
                    onChange={(e) =>
                        onAssetSelect(record.id, e.target.checked)
                    }
                />
            ),
        },
        {
            title: "Preview",
            key: "preview",
            width: 100,
            render: (_, record) => (
                <div
                    className="w-16 h-16 cursor-pointer rounded overflow-hidden bg-gray-100 flex items-center justify-center"
                    onClick={() => onAssetClick(record)}
                >
                    {record.asset_type === "image" ? (
                        record.url ? (
                            <Image
                                src={record.url}
                                alt={record.name}
                                preview={false}
                                className="w-full h-full object-cover"
                                fallback="/img/placeholder.png"
                                onError={(e) => {
                                    console.error('Image load error:', record.url, record);
                                }}
                            />
                        ) : (
                            <FileImageOutlined className="text-2xl text-gray-400" />
                        )
                    ) : record.asset_type === "video" ||
                      record.asset_type === "video_url" ? (
                        <VideoCameraOutlined className="text-2xl text-gray-400" />
                    ) : record.asset_type === "tour_360_url" ? (
                        <GlobalOutlined className="text-2xl text-gray-400" />
                    ) : null}
                </div>
            ),
        },
        {
            title: "Name",
            dataIndex: "name",
            key: "name",
            render: (name: string, record) => (
                <div>
                    <Text
                        strong
                        className="cursor-pointer hover:text-blue-600"
                        onClick={() => onAssetClick(record)}
                    >
                        {name}
                    </Text>
                    {record.tags && record.tags.length > 0 && (
                        <div className="mt-1">
                            <Space size={4} wrap>
                                {record.tags.map((tag) => (
                                    <Tag key={tag} color="blue" className="text-xs">
                                        {tag}
                                    </Tag>
                                ))}
                            </Space>
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: "Type",
            dataIndex: "asset_type",
            key: "asset_type",
            width: 120,
            render: (type: PropertyAsset["asset_type"]) => (
                <Space>
                    {getAssetIcon(type)}
                    <Text className="capitalize">
                        {type.replace("_", " ")}
                    </Text>
                </Space>
            ),
        },
        {
            title: "Size",
            dataIndex: "formatted_size",
            key: "size",
            width: 100,
            render: (size: string) => <Text>{size || "N/A"}</Text>,
        },
        {
            title: "Date Added",
            dataIndex: "created_at",
            key: "created_at",
            width: 150,
            render: (date: string) => (
                <Text>{dayjs(date).format("MMM D, YYYY h:mm A")}</Text>
            ),
        },
    ];

    const paginationMeta: LaravelPaginationMeta = {
        current_page: pagination.current,
        last_page: Math.ceil(pagination.total / pagination.pageSize),
        per_page: pagination.pageSize,
        total: pagination.total,
        from: (pagination.current - 1) * pagination.pageSize + 1,
        to: Math.min(pagination.current * pagination.pageSize, pagination.total),
    };

    return (
        <DataTable
            columns={columns}
            dataSource={assets}
            rowKey="id"
            loading={loading}
            scroll={{ x: "max-content" }}
            paginationData={paginationMeta}
            onPageChange={(page) => pagination.onChange(page, pagination.pageSize)}
        />
    );
};

export default AssetTableView;
