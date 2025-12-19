import React, { useState } from "react";
import { router } from "@inertiajs/react";
import { Property, PropertyAsset, Pagination } from "@/Types";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiResponse } from "@/lib/api/types";
import {
    Button,
    Space,
    Segmented,
    Upload,
    Modal,
    Select,
    Input,
    message,
} from "antd";
import {
    AppstoreOutlined,
    UnorderedListOutlined,
    UploadOutlined,
    PlusOutlined,
    FilterOutlined,
} from "@ant-design/icons";
import AssetGridView from "@/Features/Properties/Assets/AssetGridView";
import AssetTableView from "@/Features/Properties/Assets/AssetTableView";
import AssetPreviewModal from "@/Features/Properties/Assets/AssetPreviewModal";
import BulkAssetActionSelector from "@/Features/Properties/Assets/BulkActions/BulkAssetActionSelector";
import UniversalFilterDrawer from "@/Components/UniversalFilterDrawer";
import createPropertyAssetFilterConfig from "@/configs/propertyAssetFilterConfig";
import type { UploadFile } from "antd";

interface ManageAssetsProps {
    pageTitle: string;
    property: Property;
    assets: Pagination<PropertyAsset>;
    availableTags: Record<string, string>;
    availableTypes: Record<string, string>;
    filters: {
        asset_type?: string;
        tags?: string[];
        search?: string;
        sort_by?: string;
        sort_order?: string;
    };
}

const ManageAssets = ({
    pageTitle,
    property,
    assets,
    availableTags,
    availableTypes,
    filters,
}: ManageAssetsProps) => {
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
    const [selectedAssets, setSelectedAssets] = useState<number[]>([]);
    const [previewAsset, setPreviewAsset] = useState<PropertyAsset | null>(
        null
    );
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);

    const breadcrumbs = [
        { name: "Properties", url: route("properties.index") },
        {
            name: property.title,
            url: route("properties.show", property.id),
        },
        { name: "Manage Assets" },
    ];

    // Debug: Check assets data
    React.useEffect(() => {
        console.log('Assets data:', assets);
        if (assets.data && assets.data.length > 0) {
            console.log('First asset:', assets.data[0]);
            console.log('First asset URL:', assets.data[0].url);
        }
    }, [assets]);

    const filterConfig = createPropertyAssetFilterConfig(
        availableTags,
        availableTypes
    );

    // Upload assets mutation
    interface UploadAssetsPayload {
        files: File[];
        asset_type: string;
    }

    interface UploadAssetsResponse {
        assets: PropertyAsset[];
    }

    const { mutate: uploadAssets, isPending: isUploading } = useApiMutate<
        FormData,
        UploadAssetsResponse,
        ApiResponse<UploadAssetsResponse>
    >(
        route("properties.assets.store", property.id),
        "POST",
        (response) => {
            console.log('Upload response:', response);
            setIsUploadModalOpen(false);
            setUploadFileList([]);
            // Refresh the page to show new assets
            router.reload({ only: ["assets"] });
        },
      
    );

    // Handle asset selection
    const handleAssetSelect = (assetId: number, checked: boolean) => {
        setSelectedAssets((prev) =>
            checked ? [...prev, assetId] : prev.filter((id) => id !== assetId)
        );
    };

    const handleSelectAll = (checked: boolean) => {
        setSelectedAssets(checked ? assets.data.map((a) => a.id) : []);
    };

    // Handle asset upload
    const handleUpload = () => {
        if (uploadFileList.length === 0) {
            message.warning("Please select files to upload");
            return;
        }

        const formData = new FormData();
        uploadFileList.forEach((file) => {
            if (file.originFileObj) {
                formData.append("files[]", file.originFileObj);
            }
        });
        formData.append("asset_type", "image");

        uploadAssets(formData as any);
    };

    const handlePaginationChange = (page: number, pageSize: number) => {
        router.get(
            route("properties.assets.index", property.id),
            {
                ...filters,
                page,
                per_page: pageSize,
            },
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
    };

    return (
        <>
            <PageLayout title={pageTitle} breadcrumbs={breadcrumbs}>
                <div className="max-w-7xl mx-auto space-y-6">
                {/* Actions Bar */}
                <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
                    <Space size="middle">
                        <Button
                            type="primary"
                            icon={<UploadOutlined />}
                            onClick={() => setIsUploadModalOpen(true)}
                        >
                            Upload Assets
                        </Button>

                        {selectedAssets.length > 0 && (
                            <BulkAssetActionSelector
                                selectedEntityIds={selectedAssets}
                                propertyId={property.id}
                                availableTags={availableTags}
                                clearSelected={() => setSelectedAssets([])}
                            />
                        )}

                        <UniversalFilterDrawer config={filterConfig} />
                    </Space>

                    <Segmented
                        value={viewMode}
                        onChange={(value) => setViewMode(value as any)}
                        options={[
                            {
                                label: "Grid",
                                value: "grid",
                                icon: <AppstoreOutlined />,
                            },
                            {
                                label: "Table",
                                value: "table",
                                icon: <UnorderedListOutlined />,
                            },
                        ]}
                    />
                </div>

                {/* Asset Display */}
                {viewMode === "grid" ? (
                    <AssetGridView
                        assets={assets.data}
                        selectedAssets={selectedAssets}
                        onAssetClick={setPreviewAsset}
                        onAssetSelect={handleAssetSelect}
                        onSelectAll={handleSelectAll}
                    />
                ) : (
                    <AssetTableView
                        assets={assets.data}
                        selectedAssets={selectedAssets}
                        pagination={{
                            current: assets.current_page,
                            pageSize: assets.per_page,
                            total: assets.total,
                            onChange: handlePaginationChange,
                        }}
                        onAssetClick={setPreviewAsset}
                        onAssetSelect={handleAssetSelect}
                        onSelectAll={handleSelectAll}
                    />
                )}

                {/* Grid Pagination */}
                {viewMode === "grid" && assets.data.length > 0 && (
                    <div className="mt-6 flex justify-center">
                        <Space>
                            <Button
                                disabled={!assets.prev_page_url}
                                onClick={() =>
                                    handlePaginationChange(
                                        assets.current_page - 1,
                                        assets.per_page
                                    )
                                }
                            >
                                Previous
                            </Button>
                            <span className="px-4">
                                Page {assets.current_page} of {assets.last_page}
                            </span>
                            <Button
                                disabled={!assets.next_page_url}
                                onClick={() =>
                                    handlePaginationChange(
                                        assets.current_page + 1,
                                        assets.per_page
                                    )
                                }
                            >
                                Next
                            </Button>
                        </Space>
                    </div>
                )}

                </div>

                {/* Upload Modal */}
                <Modal
                    title="Upload Assets"
                    open={isUploadModalOpen}
                    onCancel={() => {
                        setIsUploadModalOpen(false);
                        setUploadFileList([]);
                    }}
                    onOk={handleUpload}
                    okText="Upload"
                    confirmLoading={isUploading}
                    width={600}
                >
                    <Upload
                        listType="picture-card"
                        fileList={uploadFileList}
                        onChange={({ fileList }) => setUploadFileList(fileList)}
                        beforeUpload={() => false}
                        multiple
                        accept="image/*,video/*"
                    >
                        <div>
                            <PlusOutlined />
                            <div style={{ marginTop: 8 }}>Upload</div>
                        </div>
                    </Upload>
                </Modal>

                {/* Preview Modal */}
                <AssetPreviewModal
                    open={!!previewAsset}
                    asset={previewAsset}
                    allAssets={assets.data}
                    onClose={() => setPreviewAsset(null)}
                    onNavigate={setPreviewAsset}
                />
            </PageLayout>
        </>
    );
};
ManageAssets.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default ManageAssets;
