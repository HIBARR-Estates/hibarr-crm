import React, { useState } from "react";
import {
    Card,
    Row,
    Col,
    Typography,
    Button,
    Carousel,
    Image,
    Modal,
    Upload,
    Input,
    Form,
    message,
    Divider,
    Space,
    Empty,
} from "antd";
import {
    EditOutlined,
    VideoCameraOutlined,
    FileImageOutlined,
    EyeOutlined,
    DeleteOutlined,
    PlusOutlined,
    LinkOutlined,
    CameraOutlined,
    ExclamationCircleOutlined,
} from "@ant-design/icons";
import { Property } from "@/Types";
import { router } from "@inertiajs/react";
import ConfirmationModal from "@/Components/Common/ConfirmationModal";

const { Text, Title } = Typography;

interface AssetsTabProps {
    property: Partial<Property>;
    canEdit?: boolean;
}

export default function AssetsTab({
    property,
    canEdit = false,
}: AssetsTabProps) {
    const [editMode, setEditMode] = useState(false);
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewImage, setPreviewImage] = useState("");
    const [previewTitle, setPreviewTitle] = useState("");
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    if (!property) {
        return (
            <Card title="Property Assets">
                <Empty description="No property data available" />
            </Card>
        );
    }

    const photos = property.photos || [];
    const hasAssets =
        photos.length > 0 || property.video_url || property.tour_360_url;

    const handlePreview = (file: any) => {
        setPreviewImage(file.url || file.preview);
        setPreviewVisible(true);
        setPreviewTitle(
            file.name || file.url?.substring(file.url.lastIndexOf("/") + 1)
        );
    };

    const handleEditToggle = () => {
        if (editMode) {
            // Exiting edit mode - just toggle
            setEditMode(false);
            setUploadedFiles([]); // Clear any uploaded files
        } else {
            // Entering edit mode - initialize form with current values
            form.setFieldsValue({
                video_url: property.video_url || "",
                tour_360_url: property.tour_360_url || "",
            });
            setUploadedFiles([]); // Start with empty file list
            setEditMode(true);
        }
        console.log("Edit mode toggled:", !editMode);
    };

    const handleSave = async (values: any) => {
        setLoading(true);
        console.log("Saving assets with values:", values);
        console.log("Form values:", form.getFieldsValue());
        console.log("Uploaded files state:", uploadedFiles);

        try {
            // Handle photo uploads - use uploadedFiles state
            if (uploadedFiles.length > 0) {
                const formData = new FormData();
                uploadedFiles.forEach((file: any) => {
                    console.log("Processing file:", file);
                    if (file.originFileObj) {
                        formData.append("photos[]", file.originFileObj);
                    }
                });

                console.log("Submitting photos FormData");
                router.post(
                    route("properties.update_photos", property.id),
                    formData,
                    {
                        preserveScroll: true,
                        onSuccess: () => {
                            message.success("Photos updated successfully");
                            setUploadedFiles([]); // Clear uploaded files
                        },
                        onError: (errors) => {
                            message.error("Failed to update photos");
                            console.error(errors);
                        },
                    }
                );
            }

            // Handle video URL update
            if (values.video_url !== property.video_url && values.video_url) {
                router.post(
                    route("properties.update_video", property.id),
                    { video_url: values.video_url },
                    {
                        preserveScroll: true,
                        onSuccess: () => {
                            message.success("Video URL updated successfully");
                        },
                        onError: (errors) => {
                            message.error("Failed to update video URL");
                            console.error(errors);
                        },
                    }
                );
            }

            // Handle 360 tour URL update
            if (
                values.tour_360_url !== property.tour_360_url &&
                values.tour_360_url
            ) {
                router.post(
                    route("properties.update_360_tour", property.id),
                    { tour_360_url: values.tour_360_url },
                    {
                        preserveScroll: true,
                        onSuccess: () => {
                            message.success(
                                "360° Tour URL updated successfully"
                            );
                        },
                        onError: (errors) => {
                            message.error("Failed to update 360° tour URL");
                            console.error(errors);
                        },
                    }
                );
            }
        } catch (error) {
            message.error("Failed to update assets");
            console.error(error);
        } finally {
            setLoading(false);
            setEditMode(false);
        }
    };

    const handleDeleteAssets = () => {
        setDeleteLoading(true);
        router.delete(route("properties.delete_assets", property.id), {
            data: { asset_type: "all" },
            preserveScroll: true,
            onSuccess: () => {
                message.success("Assets deleted successfully");
                setDeleteConfirmOpen(false);
                setDeleteLoading(false);
            },
            onError: (errors) => {
                message.error("Failed to delete assets");
                console.error(errors);
                setDeleteLoading(false);
            },
        });
    };

    const openDeleteConfirmation = () => {
        setDeleteConfirmOpen(true);
    };

    const closeDeleteConfirmation = () => {
        if (!deleteLoading) {
            setDeleteConfirmOpen(false);
        }
    };

    const handleDeleteSinglePhoto = (photoUrl: string) => {
        router.delete(route("properties.delete_single_photo", property.id), {
            data: { photo_url: photoUrl },
            preserveScroll: true,
            onSuccess: () => {
                message.success("Photo deleted successfully");
            },
            onError: (errors) => {
                message.error("Failed to delete photo");
                console.error(errors);
            },
        });
    };

    const handleAddSinglePhoto = (file: File) => {
        const formData = new FormData();
        formData.append("photo", file);

        router.post(
            route("properties.add_single_photo", property.id),
            formData,
            {
                preserveScroll: true,
                onSuccess: () => {
                    message.success("Photo added successfully");
                },
                onError: (errors) => {
                    message.error("Failed to add photo");
                    console.error(errors);
                },
            }
        );
    };

    const handleUpdateSinglePhoto = (index: number, file: File) => {
        const formData = new FormData();
        formData.append("photo", file);

        router.put(
            route("properties.update_single_photo", [property.id, index]),
            formData,
            {
                preserveScroll: true,
                onSuccess: () => {
                    message.success("Photo updated successfully");
                },
                onError: (errors) => {
                    message.error("Failed to update photo");
                    console.error(errors);
                },
            }
        );
    };

    const beforeUpload = (file: File) => {
        const isImage = file.type.startsWith("image/");
        if (!isImage) {
            message.error("You can only upload image files!");
            return false;
        }
        const isLt10M = file.size / 1024 / 1024 < 10;
        if (!isLt10M) {
            message.error("Image must be smaller than 10MB!");
            return false;
        }
        console.log("File passed validation:", file.name);
        return true; // Allow upload processing
    };

    const handleUploadChange = (info: any) => {
        console.log("Upload change:", info);
        setUploadedFiles(info.fileList);
        // Update form field value when files change
        form.setFieldsValue({
            photos: info,
        });
    };

    const customRequest = (options: any) => {
        // Custom upload handler - just mark as done
        const { onSuccess, file } = options;
        setTimeout(() => {
            onSuccess("ok");
        }, 0);
    };

    return (
        <Card
            title="Property Assets"
            extra={
                canEdit && (
                    <Space>
                        {editMode ? (
                            <>
                                <Button
                                    type="default"
                                    onClick={() => setEditMode(false)}
                                    disabled={loading}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="primary"
                                    icon={<EditOutlined />}
                                    onClick={() => form.submit()}
                                    loading={loading}
                                >
                                    Save Changes
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    type="default"
                                    icon={<EditOutlined />}
                                    onClick={handleEditToggle}
                                >
                                    Edit Assets
                                </Button>
                                {hasAssets && (
                                    <Button
                                        type="default"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={openDeleteConfirmation}
                                    >
                                        Delete All
                                    </Button>
                                )}
                            </>
                        )}
                    </Space>
                )
            }
        >
            {editMode ? (
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                    onFinishFailed={(errorInfo) => {
                        console.log("Form validation failed:", errorInfo);
                        message.error("Please check the form for errors");
                    }}
                    onValuesChange={(changedValues, allValues) => {
                        console.log(
                            "Form values changed:",
                            changedValues,
                            allValues
                        );
                    }}
                >
                    <Row gutter={[16, 16]}>
                        <Col span={24}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Property Photos
                                </label>
                                <div className="property-assets-upload">
                                    <Upload.Dragger
                                        name="photos"
                                        multiple
                                        listType="picture-card"
                                        beforeUpload={beforeUpload}
                                        customRequest={customRequest}
                                        onPreview={handlePreview}
                                        accept="image/*"
                                        onChange={handleUploadChange}
                                        fileList={uploadedFiles}
                                    >
                                        <div>
                                            <PlusOutlined />
                                            <div style={{ marginTop: 8 }}>
                                                Upload Photos
                                            </div>
                                        </div>
                                    </Upload.Dragger>
                                </div>
                                <Text type="secondary" className="block mt-2">
                                    Support for multiple photo uploads. JPG,
                                    PNG, WebP files only. Max 10MB per file.
                                </Text>
                            </div>
                        </Col>

                        <Col span={12}>
                            <Form.Item name="video_url" label="Video URL">
                                <Input
                                    placeholder="YouTube, Vimeo or direct video URL"
                                    prefix={<VideoCameraOutlined />}
                                />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Form.Item
                                name="tour_360_url"
                                label="360° Tour URL"
                            >
                                <Input
                                    placeholder="360° virtual tour URL"
                                    prefix={<CameraOutlined />}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            ) : (
                <>
                    {!hasAssets ? (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="No assets available for this property"
                        >
                            {canEdit && (
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={handleEditToggle}
                                >
                                    Add Assets
                                </Button>
                            )}
                        </Empty>
                    ) : (
                        <Row gutter={[16, 24]}>
                            {/* Photo Carousel */}
                            {photos.length > 0 && (
                                <Col span={24}>
                                    <Title level={5}>
                                        <FileImageOutlined className="mr-2" />
                                        Property Photos ({photos.length})
                                    </Title>
                                    <div className="property-photo-carousel">
                                        <Carousel
                                            dots
                                            infinite
                                            autoplay
                                            autoplaySpeed={4000}
                                            className="bg-gray-50 rounded-lg overflow-hidden"
                                        >
                                            {photos.map((photo, index) => (
                                                <div
                                                    key={index}
                                                    className="relative"
                                                >
                                                    <div
                                                        className="h-64 bg-cover bg-center cursor-pointer relative group"
                                                        style={{
                                                            backgroundImage: `url(${photo})`,
                                                        }}
                                                        onClick={() =>
                                                            handlePreview({
                                                                url: photo,
                                                                name: `Photo ${
                                                                    index + 1
                                                                }`,
                                                            })
                                                        }
                                                    >
                                                        <div className="absolute inset-0 bg-black/5 bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                                                            <EyeOutlined className="text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </Carousel>
                                    </div>

                                    {/* Photo Thumbnails */}
                                    <div className="property-photo-thumbnails mt-4">
                                        <Image.PreviewGroup>
                                            <div className="grid grid-cols-6 gap-2">
                                                {photos
                                                    .slice(0, 6)
                                                    .map((photo, index) => (
                                                        <div
                                                            key={index}
                                                            className="relative group"
                                                        >
                                                            <Image
                                                                src={photo}
                                                                alt={`Photo ${
                                                                    index + 1
                                                                }`}
                                                                width={80}
                                                                height={60}
                                                                className="object-cover rounded cursor-pointer border border-gray-200 hover:border-blue-400 transition-colors"
                                                                preview={{
                                                                    mask: (
                                                                        <EyeOutlined className="text-white" />
                                                                    ),
                                                                }}
                                                            />
                                                            {canEdit && (
                                                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <Space size="small">
                                                                        <Button
                                                                            type="primary"
                                                                            size="small"
                                                                            icon={
                                                                                <EditOutlined />
                                                                            }
                                                                            className="shadow-md"
                                                                            style={{
                                                                                fontSize:
                                                                                    "10px",
                                                                                padding:
                                                                                    "2px 4px",
                                                                            }}
                                                                            onClick={() => {
                                                                                const input =
                                                                                    document.createElement(
                                                                                        "input"
                                                                                    );
                                                                                input.type =
                                                                                    "file";
                                                                                input.accept =
                                                                                    "image/*";
                                                                                input.onchange =
                                                                                    (
                                                                                        e
                                                                                    ) => {
                                                                                        const file =
                                                                                            (
                                                                                                e.target as HTMLInputElement
                                                                                            )
                                                                                                .files?.[0];
                                                                                        if (
                                                                                            file
                                                                                        ) {
                                                                                            handleUpdateSinglePhoto(
                                                                                                index,
                                                                                                file
                                                                                            );
                                                                                        }
                                                                                    };
                                                                                input.click();
                                                                            }}
                                                                        />
                                                                        <Button
                                                                            type="primary"
                                                                            danger
                                                                            size="small"
                                                                            icon={
                                                                                <DeleteOutlined />
                                                                            }
                                                                            className="shadow-md"
                                                                            style={{
                                                                                fontSize:
                                                                                    "10px",
                                                                                padding:
                                                                                    "2px 4px",
                                                                            }}
                                                                            onClick={() =>
                                                                                handleDeleteSinglePhoto(
                                                                                    photo
                                                                                )
                                                                            }
                                                                        />
                                                                    </Space>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                {photos.length > 6 && (
                                                    <div className="w-20 h-15 bg-gray-100 rounded flex items-center justify-center text-gray-500 text-sm border border-gray-200">
                                                        +{photos.length - 6}
                                                    </div>
                                                )}
                                                {canEdit && (
                                                    <div
                                                        className="w-20 h-15 bg-blue-50 border-2 border-dashed border-blue-300 rounded flex items-center justify-center cursor-pointer hover:bg-blue-100 transition-colors"
                                                        onClick={() => {
                                                            const input =
                                                                document.createElement(
                                                                    "input"
                                                                );
                                                            input.type = "file";
                                                            input.accept =
                                                                "image/*";
                                                            input.onchange = (
                                                                e
                                                            ) => {
                                                                const file = (
                                                                    e.target as HTMLInputElement
                                                                ).files?.[0];
                                                                if (file) {
                                                                    handleAddSinglePhoto(
                                                                        file
                                                                    );
                                                                }
                                                            };
                                                            input.click();
                                                        }}
                                                    >
                                                        <PlusOutlined className="text-blue-500" />
                                                    </div>
                                                )}
                                            </div>
                                        </Image.PreviewGroup>
                                    </div>
                                </Col>
                            )}

                            {/* Video & 360 Tour Links */}
                            {(property.video_url || property.tour_360_url) && (
                                <Col span={24}>
                                    <Divider />
                                    <Title level={5}>
                                        <LinkOutlined className="mr-2" />
                                        Media Links
                                    </Title>
                                    <Row
                                        gutter={[16, 16]}
                                        className="property-media-links"
                                    >
                                        {property.video_url && (
                                            <Col xs={24} sm={12}>
                                                <Card
                                                    size="small"
                                                    title={
                                                        <Space>
                                                            <VideoCameraOutlined />
                                                            Property Video
                                                        </Space>
                                                    }
                                                    extra={
                                                        <Button
                                                            type="link"
                                                            icon={
                                                                <EyeOutlined />
                                                            }
                                                            href={
                                                                property.video_url
                                                            }
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            View
                                                        </Button>
                                                    }
                                                >
                                                    <Text
                                                        type="secondary"
                                                        ellipsis
                                                    >
                                                        {property.video_url}
                                                    </Text>
                                                </Card>
                                            </Col>
                                        )}

                                        {property.tour_360_url && (
                                            <Col xs={24} sm={12}>
                                                <Card
                                                    size="small"
                                                    title={
                                                        <Space>
                                                            <CameraOutlined />
                                                            360° Virtual Tour
                                                        </Space>
                                                    }
                                                    extra={
                                                        <Button
                                                            type="link"
                                                            icon={
                                                                <EyeOutlined />
                                                            }
                                                            href={
                                                                property.tour_360_url
                                                            }
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            View
                                                        </Button>
                                                    }
                                                >
                                                    <Text
                                                        type="secondary"
                                                        ellipsis
                                                    >
                                                        {property.tour_360_url}
                                                    </Text>
                                                </Card>
                                            </Col>
                                        )}
                                    </Row>
                                </Col>
                            )}
                        </Row>
                    )}
                </>
            )}

            {/* Preview Modal */}
            <Modal
                open={previewVisible}
                title={previewTitle}
                footer={null}
                onCancel={() => setPreviewVisible(false)}
                centered
                width="90%"
                style={{ maxWidth: 1000 }}
                className="property-asset-preview"
            >
                <img
                    alt="preview"
                    style={{
                        width: "100%",
                        maxHeight: "70vh",
                        objectFit: "contain",
                    }}
                    src={previewImage}
                />
            </Modal>

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                open={deleteConfirmOpen}
                onClose={closeDeleteConfirmation}
                onSubmit={{
                    fn: handleDeleteAssets,
                    loading: deleteLoading,
                }}
                title="Delete All Assets"
                description="Are you sure you want to delete all property assets? This action cannot be undone."
                icon={<DeleteOutlined className="text-red-500 text-3xl" />}
                confirmText="Yes, Delete All"
                cancelText="Cancel"
                confirmDanger
            />
        </Card>
    );
}
