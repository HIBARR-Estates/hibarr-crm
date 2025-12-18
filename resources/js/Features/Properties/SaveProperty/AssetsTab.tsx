import React from "react";
import {
    Card,
    Row,
    Col,
    Typography,
    Button,
    Image,
    Empty,
    Space,
    Tag,
    Statistic,
} from "antd";
import {
    FileImageOutlined,
    VideoCameraOutlined,
    EyeOutlined,
    PlusOutlined,
    CameraOutlined,
    FolderOpenOutlined,
} from "@ant-design/icons";
import { Property } from "@/Types";
import { router } from "@inertiajs/react";

const { Text, Title } = Typography;

interface AssetsTabProps {
    property: Partial<Property>;
    canEdit?: boolean;
}

export default function AssetsTab({
    property,
    canEdit = false,
}: AssetsTabProps) {
    if (!property || !property.id) {
        return (
            <Card title="Property Assets">
                <Empty description="Property must be saved before managing assets" />
            </Card>
        );
    }

    // Get assets from the new PropertyAsset system
    const imageAssets = property.assets?.filter(asset => asset.asset_type === 'image') || [];
    const videoAssets = property.assets?.filter(asset => 
        asset.asset_type === 'video' || asset.asset_type === 'video_url'
    ) || [];
    const tourAssets = property.assets?.filter(asset => 
        asset.asset_type === 'tour_360_url'
    ) || [];
    
    const totalAssets = (property.assets?.length || 0);
    const hasAssets = totalAssets > 0;

    const handleManageAssets = () => {
        router.visit(route('properties.assets.index', property.id));
    };

    return (
        <Card
            title={
                <Space>
                    <FolderOpenOutlined />
                    <span>Property Assets</span>
                    {totalAssets > 0 && (
                        <Tag color="blue">{totalAssets} {totalAssets === 1 ? 'Asset' : 'Assets'}</Tag>
                    )}
                </Space>
            }
            extra={
                canEdit && (
                    <Button
                        type="primary"
                        icon={hasAssets ? <FolderOpenOutlined /> : <PlusOutlined />}
                        onClick={handleManageAssets}
                    >
                        {hasAssets ? 'Manage Assets' : 'Add Assets'}
                    </Button>
                )
            }
        >
            {!hasAssets ? (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                        <Space direction="vertical">
                            <Text>No assets uploaded yet</Text>
                            <Text type="secondary" className="text-sm">
                                Upload images, videos, and 360° tours to showcase this property
                            </Text>
                        </Space>
                    }
                >
                    {canEdit && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleManageAssets}
                        >
                            Upload Assets
                        </Button>
                    )}
                </Empty>
            ) : (
                <Row gutter={[16, 24]}>
                    {/* Asset Statistics */}
                    <Col span={24}>
                        <Row gutter={16}>
                            <Col xs={8}>
                                <Statistic
                                    title="Images"
                                    value={imageAssets.length}
                                    prefix={<FileImageOutlined />}
                                    valueStyle={{ color: '#3f8600' }}
                                />
                            </Col>
                            <Col xs={8}>
                                <Statistic
                                    title="Videos"
                                    value={videoAssets.length}
                                    prefix={<VideoCameraOutlined />}
                                    valueStyle={{ color: '#cf1322' }}
                                />
                            </Col>
                            <Col xs={8}>
                                <Statistic
                                    title="360° Tours"
                                    value={tourAssets.length}
                                    prefix={<CameraOutlined />}
                                    valueStyle={{ color: '#1890ff' }}
                                />
                            </Col>
                        </Row>
                    </Col>

                    {/* Image Preview Gallery */}
                    {imageAssets.length > 0 && (
                        <Col span={24}>
                            <Title level={5}>
                                <FileImageOutlined className="mr-2" />
                                Recent Images
                            </Title>
                            <Image.PreviewGroup>
                                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                                    {imageAssets.slice(0, 6).map((asset) => (
                                        <div key={asset.id} className="relative group">
                                            <Image
                                                src={asset.url}
                                                alt={asset.name}
                                                className="object-cover rounded cursor-pointer border border-gray-200 hover:border-blue-400 transition-colors w-full h-20"
                                                preview={{
                                                    mask: <EyeOutlined className="text-white" />,
                                                }}
                                            />
                                            {asset.tags && asset.tags.length > 0 && (
                                                <div className="absolute bottom-1 left-1 right-1">
                                                    <Tag 
                                                        color="blue" 
                                                        className="text-xs truncate"
                                                        style={{ maxWidth: '100%' }}
                                                    >
                                                        {asset.tags[0]}
                                                    </Tag>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {imageAssets.length > 6 && (
                                        <div className="w-full h-20 bg-gray-100 rounded flex items-center justify-center text-gray-500 text-sm border border-gray-200">
                                            +{imageAssets.length - 6}
                                        </div>
                                    )}
                                </div>
                            </Image.PreviewGroup>
                        </Col>
                    )}

                    {/* Video & Tour Links */}
                    {(videoAssets.length > 0 || tourAssets.length > 0) && (
                        <Col span={24}>
                            <Title level={5}>Media Links</Title>
                            <Row gutter={[16, 16]}>
                                {videoAssets.map((asset) => (
                                    <Col xs={24} sm={12} key={asset.id}>
                                        <Card
                                            size="small"
                                            className="hover:shadow-md transition-shadow"
                                        >
                                            <Space direction="vertical" style={{ width: '100%' }}>
                                                <Space>
                                                    <VideoCameraOutlined className="text-red-500" />
                                                    <Text strong>{asset.name}</Text>
                                                </Space>
                                                <Text type="secondary" ellipsis>
                                                    {asset.external_url || asset.url}
                                                </Text>
                                                <Button
                                                    type="link"
                                                    icon={<EyeOutlined />}
                                                    href={asset.external_url || asset.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-0"
                                                >
                                                    Watch Video
                                                </Button>
                                            </Space>
                                        </Card>
                                    </Col>
                                ))}

                                {tourAssets.map((asset) => (
                                    <Col xs={24} sm={12} key={asset.id}>
                                        <Card
                                            size="small"
                                            className="hover:shadow-md transition-shadow"
                                        >
                                            <Space direction="vertical" style={{ width: '100%' }}>
                                                <Space>
                                                    <CameraOutlined className="text-blue-500" />
                                                    <Text strong>{asset.name}</Text>
                                                </Space>
                                                <Text type="secondary" ellipsis>
                                                    {asset.external_url || asset.url}
                                                </Text>
                                                <Button
                                                    type="link"
                                                    icon={<EyeOutlined />}
                                                    href={asset.external_url || asset.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-0"
                                                >
                                                    Take Virtual Tour
                                                </Button>
                                            </Space>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        </Col>
                    )}

                    {/* View All Button */}
                    <Col span={24}>
                        <Button
                            type="dashed"
                            icon={<FolderOpenOutlined />}
                            onClick={handleManageAssets}
                            block
                            size="large"
                        >
                            View All Assets & Manage Tags
                        </Button>
                    </Col>
                </Row>
            )}
        </Card>
    );
}

