import { useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import {
    Alert,
    Button,
    Card,
    Divider,
    Image,
    Input,
    Space,
    Switch,
    Typography,
} from "antd";
import { UploadOutlined, DeleteOutlined } from "@ant-design/icons";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import type { PageProps } from "../../Components/DashboardLayout";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { useFormDataMutate } from "@/lib/api/client/useFormDataMutate";
import type { ApiSuccessResponse } from "@/lib/api/types";

interface CompanyExposeConfiguration {
    id: number;
    company_id: number;
    outro_enabled: boolean;
    outro_title: string | null;
    outro_description: string | null;
    outro_primary_image: string | null;
    outro_secondary_image: string | null;
    outro_primary_image_url?: string | null;
    outro_secondary_image_url?: string | null;
    qr_enabled: boolean;
    qr_code_link: string | null;
}

interface ExposeConfigurationIndexProps extends PageProps {
    pageTitle: string;
    config: CompanyExposeConfiguration;
}

const ExposeConfigurationIndex = ({
    pageTitle,
    config,
}: ExposeConfigurationIndexProps) => {
    const [outroEnabled, setOutroEnabled] = useState<boolean>(
        Boolean(config?.outro_enabled),
    );
    const [outroTitle, setOutroTitle] = useState<string>(
        config?.outro_title ?? "",
    );
    const [outroDescription, setOutroDescription] = useState<string>(
        config?.outro_description ?? "",
    );
    const [qrEnabled, setQrEnabled] = useState<boolean>(
        Boolean(config?.qr_enabled),
    );
    const [qrCodeLink, setQrCodeLink] = useState<string>(
        config?.qr_code_link ?? "",
    );

    const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(
        config?.outro_primary_image_url ?? null,
    );
    const [secondaryImageUrl, setSecondaryImageUrl] = useState<string | null>(
        config?.outro_secondary_image_url ?? null,
    );

    const [removePrimaryImage, setRemovePrimaryImage] = useState(false);
    const [removeSecondaryImage, setRemoveSecondaryImage] = useState(false);

    const { mutate: saveConfig, isPending: isSaving } = useApiMutate<
        {
            outro_enabled: boolean;
            outro_title: string;
            outro_description: string;
            qr_enabled: boolean;
            qr_code_link: string;
            remove_outro_primary_image: boolean;
            remove_outro_secondary_image: boolean;
        },
        CompanyExposeConfiguration,
        ApiSuccessResponse<CompanyExposeConfiguration>
    >(route("expose-configuration.update"), "PUT", () => {
        router.reload({ only: ["config"] });
    });

    const { mutateAsync: uploadImage, isPending: isUploading } =
        useFormDataMutate<
            {
                field: "outro_primary_image" | "outro_secondary_image";
                filename: string;
                url: string;
            },
            ApiSuccessResponse<{
                field: "outro_primary_image" | "outro_secondary_image";
                filename: string;
                url: string;
            }>
        >(route("expose-configuration.upload-image"), "POST", () => {
            router.reload({ only: ["config"] });
        });

    const onUpload = async (
        field: "outro_primary_image" | "outro_secondary_image",
        file: File,
    ) => {
        const formData = new FormData();
        formData.append("field", field);
        formData.append("file", file);

        const response = await uploadImage(formData);
        const uploadedUrl = response?.data?.url;

        if (uploadedUrl) {
            if (field === "outro_primary_image") {
                setPrimaryImageUrl(uploadedUrl);
                setRemovePrimaryImage(false);
            } else {
                setSecondaryImageUrl(uploadedUrl);
                setRemoveSecondaryImage(false);
            }
        }
    };

    const onSelectUploadFile = (
        field: "outro_primary_image" | "outro_secondary_image",
    ) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/png,image/jpeg,image/webp";
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            await onUpload(field, file);
        };
        input.click();
    };

    const canSave = useMemo(() => {
        if (outroEnabled) {
            if (!outroTitle.trim()) return false;
            if (!outroDescription.trim()) return false;
            if (!primaryImageUrl && !removePrimaryImage) return false;
            if (!primaryImageUrl && removePrimaryImage) return false;
        }

        if (qrEnabled && !qrCodeLink.trim()) {
            return false;
        }

        return true;
    }, [
        outroEnabled,
        outroTitle,
        outroDescription,
        primaryImageUrl,
        removePrimaryImage,
        qrEnabled,
        qrCodeLink,
    ]);

    const handleSave = () => {
        saveConfig({
            outro_enabled: outroEnabled,
            outro_title: outroTitle,
            outro_description: outroDescription,
            qr_enabled: qrEnabled,
            qr_code_link: qrCodeLink,
            remove_outro_primary_image: removePrimaryImage,
            remove_outro_secondary_image: removeSecondaryImage,
        });
    };

    const clearPrimaryImage = () => {
        setPrimaryImageUrl(null);
        setRemovePrimaryImage(true);
    };

    const clearSecondaryImage = () => {
        setSecondaryImageUrl(null);
        setRemoveSecondaryImage(true);
    };

    return (
        <PageLayout
            title={pageTitle}
            breadcrumbs={[
                { name: "Properties", url: route("properties.index") },
                { name: "Expose Configuration" },
            ]}
        >
            <div className="max-w-5xl mx-auto space-y-6">
                <Alert
                    type="info"
                    showIcon
                    message="Global Company Configuration"
                    description="These settings are used for all generated exposes (project brochure and unit/property exposes)."
                />

                <Card title="Outro">
                    <div className="space-y-4">
                        <Space align="center">
                            <Switch
                                checked={outroEnabled}
                                onChange={setOutroEnabled}
                            />
                            <Typography.Text strong>
                                Enable Outro Section
                            </Typography.Text>
                        </Space>

                        {outroEnabled && (
                            <>
                                <Input
                                    value={outroTitle}
                                    onChange={(e) =>
                                        setOutroTitle(e.target.value)
                                    }
                                    placeholder="Outro title"
                                    maxLength={255}
                                />

                                <Input.TextArea
                                    value={outroDescription}
                                    onChange={(e) =>
                                        setOutroDescription(e.target.value)
                                    }
                                    placeholder="Outro description"
                                    rows={5}
                                />

                                <Divider orientation="left">Images</Divider>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <Card size="small" title="Primary Image">
                                        <div className="space-y-3">
                                            {primaryImageUrl ? (
                                                <Image
                                                    src={primaryImageUrl}
                                                    alt="Outro primary"
                                                    width="100%"
                                                    className="rounded"
                                                />
                                            ) : (
                                                <div className="h-40 border border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-sm">
                                                    No image uploaded
                                                </div>
                                            )}
                                            <Space>
                                                <Button
                                                    icon={<UploadOutlined />}
                                                    onClick={() =>
                                                        onSelectUploadFile(
                                                            "outro_primary_image",
                                                        )
                                                    }
                                                    loading={isUploading}
                                                >
                                                    Upload
                                                </Button>
                                                {primaryImageUrl && (
                                                    <Button
                                                        danger
                                                        icon={
                                                            <DeleteOutlined />
                                                        }
                                                        onClick={
                                                            clearPrimaryImage
                                                        }
                                                    >
                                                        Remove
                                                    </Button>
                                                )}
                                            </Space>
                                        </div>
                                    </Card>

                                    <Card
                                        size="small"
                                        title="Secondary Image (Optional)"
                                    >
                                        <div className="space-y-3">
                                            {secondaryImageUrl ? (
                                                <Image
                                                    src={secondaryImageUrl}
                                                    alt="Outro secondary"
                                                    width="100%"
                                                    className="rounded"
                                                />
                                            ) : (
                                                <div className="h-40 border border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-sm">
                                                    No image uploaded
                                                </div>
                                            )}
                                            <Space>
                                                <Button
                                                    icon={<UploadOutlined />}
                                                    onClick={() =>
                                                        onSelectUploadFile(
                                                            "outro_secondary_image",
                                                        )
                                                    }
                                                    loading={isUploading}
                                                >
                                                    Upload
                                                </Button>
                                                {secondaryImageUrl && (
                                                    <Button
                                                        danger
                                                        icon={
                                                            <DeleteOutlined />
                                                        }
                                                        onClick={
                                                            clearSecondaryImage
                                                        }
                                                    >
                                                        Remove
                                                    </Button>
                                                )}
                                            </Space>
                                        </div>
                                    </Card>
                                </div>
                            </>
                        )}
                    </div>
                </Card>

                <Card title="QR Code">
                    <div className="space-y-4">
                        <Space align="center">
                            <Switch
                                checked={qrEnabled}
                                onChange={setQrEnabled}
                            />
                            <Typography.Text strong>
                                Enable QR Code on Exposes
                            </Typography.Text>
                        </Space>

                        {qrEnabled && (
                            <Input
                                value={qrCodeLink}
                                onChange={(e) => setQrCodeLink(e.target.value)}
                                placeholder="https://example.com/landing-page"
                                maxLength={2048}
                            />
                        )}
                    </div>
                </Card>

                <div className="flex justify-end">
                    <Button
                        type="primary"
                        loading={isSaving}
                        onClick={handleSave}
                        disabled={!canSave || isUploading}
                    >
                        Save Configuration
                    </Button>
                </div>
            </div>
        </PageLayout>
    );
};

ExposeConfigurationIndex.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default ExposeConfigurationIndex;
