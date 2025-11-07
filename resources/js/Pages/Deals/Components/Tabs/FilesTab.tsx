import { Deal } from "@/Types/api/deals";
import { DealFile } from "@/Types/api/file";
import { Empty, Button, Row, Col, Spin, Skeleton } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useState } from "react";
import { usePage, router } from "@inertiajs/react";
import FileCard from "./files/FileCard";
import FileUpload from "./files/FileUpload";

interface Props {
    deal: Deal;
    files: DealFile[];
    permissions: Record<string, string>;
}

export default function FilesTab({ deal, files, permissions }: Props) {
    const { props } = usePage();
    const user = props.auth.user;
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const canView = (file: DealFile) => {
        return (
            permissions.view_lead_files === "all" ||
            (permissions.view_lead_files === "added" &&
                file.added_by === user?.id)
        );
    };

    const canEdit = (file: DealFile) => {
        return (
            permissions.edit_lead_files === "all" ||
            (permissions.edit_lead_files === "added" &&
                file.added_by === user?.id)
        );
    };

    const canDelete = (file: DealFile) => {
        return (
            permissions.delete_lead_files === "all" ||
            (permissions.delete_lead_files === "added" &&
                file.added_by === user?.id)
        );
    };

    const canAdd =
        permissions.add_lead_files === "all" ||
        permissions.add_lead_files === "added";

    const handleFileUploaded = () => {
        setUploadModalOpen(false);
        // Reload the page to get updated file list
        router.reload({ only: ["files"] });
    };

    const handleFileDeleted = () => {
        // Reload the page to get updated file list
        router.reload({ only: ["files"] });
    };

    const handleFileUpdated = () => {
        // Reload the page to get updated file list
        router.reload({ only: ["files"] });
    };

    const handleRefresh = () => {
        setLoading(true);
        router.reload({
            only: ["files"],
            onFinish: () => setLoading(false),
        });
    };

    // Filter files based on view permissions
    const visibleFiles = files.filter((file) => canView(file));

    if (loading) {
        return (
            <div className="p-8 flex justify-center">
                {Array(4)
                    .fill(0)
                    .map((_, i) => (
                        <Skeleton
                            active
                            key={i}
                            style={{
                                width: 200,
                                height: 150,
                                margin: "0 10px",
                            }}
                        />
                    ))}
            </div>
        );
    }

    return (
        <>
            {visibleFiles.length === 0 && (
                <div className="p-8">
                    <Empty
                        description={
                            <div className="text-center">
                                <p className="text-gray-500 mb-2">
                                    No files uploaded
                                </p>
                                {canAdd && (
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={() => setUploadModalOpen(true)}
                                    >
                                        Upload First File
                                    </Button>
                                )}
                            </div>
                        }
                    />
                </div>
            )}
            {visibleFiles.length > 0 && (
                <div className="p-6">
                    {/* Header with Upload Button */}
                    {canAdd && (
                        <div className="mb-6 flex justify-end items-center">
                            <div className="space-x-2">
                                <Button
                                    icon={<ReloadOutlined />}
                                    onClick={handleRefresh}
                                    loading={loading}
                                >
                                    Refresh
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Files Grid */}
                    <Row gutter={[16, 16]}>
                        {visibleFiles.map((file) => (
                            <Col
                                key={file.id}
                                xs={24}
                                sm={12}
                                md={8}
                                lg={6}
                                xl={6}
                            >
                                <FileCard
                                    file={file}
                                    canView={canView(file)}
                                    canEdit={canEdit(file)}
                                    canDelete={canDelete(file)}
                                    onFileDeleted={handleFileDeleted}
                                    onFileUpdated={handleFileUpdated}
                                />
                            </Col>
                        ))}
                    </Row>
                </div>
            )}
            {/* Upload Modal */}
            <FileUpload
                deal={deal}
                open={uploadModalOpen}
                onClose={() => setUploadModalOpen(false)}
                onFileUploaded={handleFileUploaded}
            />
        </>
    );
}
