import React, { useState, useEffect } from "react";
import { Modal, Button, Alert, Radio, Space, Card, Skeleton } from "antd";
import { FilePdfOutlined, WarningOutlined } from "@ant-design/icons";
import { useFileDownloadMutate } from "@/lib/api/client/useFileDownloadMutate";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiResponse } from "@/lib/api/types";

interface GenerateExposeModalProps {
    open: boolean;
    onClose: () => void;
    propertyId: number;
}

interface ExposeGeneratePayload {
    layout: "vertical_standard" | "horizontal_premium";
}

interface ValidationData {
    warnings: Warning[];
}

interface Warning {
    severity: string;
    field: string;
    message: string;
}

interface LayoutOption {
    value: "vertical_standard" | "horizontal_premium";
    title: string;
    description: string;
    previewWidth: string;
    previewHeight: string;
    previewLabel: string;
}

const LAYOUT_OPTIONS: LayoutOption[] = [
    {
        value: "vertical_standard",
        title: "Vertical",
        description: "Classic portrait layout suitable for printing.",
        previewWidth: "w-12",
        previewHeight: "h-16",
        previewLabel: "Vertical",
    },
    {
        value: "horizontal_premium",
        title: "Horizontal",
        description: "Modern landscape layout optimized for screens.",
        previewWidth: "w-16",
        previewHeight: "h-12",
        previewLabel: "Horizontal",
    },
];

const GenerateExposeModal: React.FC<GenerateExposeModalProps> = ({
    open,
    onClose,
    propertyId,
}) => {
    const [warnings, setWarnings] = useState<Warning[]>([]);
    const [layout, setLayout] = useState<
        "vertical_standard" | "horizontal_premium"
    >("vertical_standard");

    const { mutate: validateExpose, isPending: isValidating } = useApiMutate<
        Record<string, never>,
        ValidationData,
        ApiResponse<ValidationData>
    >(
        `/account/properties/${propertyId}/expose/validate`,
        "POST",
       
    );

    const { mutate: generateExpose, isPending: isGenerating } = useFileDownloadMutate<ExposeGeneratePayload>(
        `/account/properties/${propertyId}/expose/generate`,
        "POST",
        {
            filename: `property-expose-${propertyId}.pdf`,
            onSuccess: () => {
                onClose();
            },
            onError: (error) => {
                console.error("Failed to generate expose:", error);
            },
        }
    );

    useEffect(() => {
        if (open) {
            setWarnings([]);
            validateExpose({}, {
                onSuccess: (response) => {
                     if (response?.data?.warnings) {
                        setWarnings(response.data.warnings);
                    } else {
                        setWarnings([]);
                    }
                }
            });
        }
    }, [open, propertyId]);

    const handleGenerate = () => {
        generateExpose({ layout });
    };

    return (
        <Modal
            title="Generate Expose PDF"
            open={open}
            onCancel={onClose}
            footer={[
                <Button key="cancel" onClick={onClose}>
                    Cancel
                </Button>,
                <Button
                    key="generate"
                    type="primary"
                    icon={<FilePdfOutlined />}
                    loading={isGenerating}
                    onClick={handleGenerate}
                    disabled={isValidating}
                >
                    Generate PDF
                </Button>,
            ]}
            width={600}
        >
            <Skeleton loading={isValidating} active>
                <div className="flex flex-col gap-y-6">
                    {warnings.length > 0 && (
                        <Alert
                            message="Missing Information"
                            description={
                                <ul className="list-disc pl-4 mt-2">
                                    {warnings.map((warning, index) => (
                                        <li key={index}>
                                            <strong>{warning.field}:</strong> {warning.message}
                                        </li>
                                    ))}
                                </ul>
                            }
                            type="warning"
                            showIcon
                            icon={<WarningOutlined />}
                            className="mb-4"
                        />
                    )}

                    <div className="mb-6">
                        <h3 className="text-base font-semibold mb-4 text-gray-800">
                            Choose Layout
                        </h3>
                        <Radio.Group
                            value={layout}
                            onChange={(e) => setLayout(e.target.value)}
                            className="w-full"
                        >
                            <Space direction="horizontal" size="middle" className="w-full flex">
                                {LAYOUT_OPTIONS.map((option) => (
                                    <Card
                                        key={option.value}
                                        size="small"
                                        className={`flex-1 cursor-pointer h-48 transition-all duration-200 ${
                                            layout === option.value
                                                ? "border-blue-500bg-blue-50"
                                                : "border-gray-200 hover:border-blue-400"
                                        }`}
                                        onClick={() => setLayout(option.value)}
                                    >
                                        <Radio value={option.value} className="w-full">
                                            <div className="flex flex-col items-center gap-3 text-center">
                                                <div
                                                    className={`${option.previewWidth} ${option.previewHeight} bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-300 rounded flex items-center justify-center`}
                                                >
                                                    <span className="text-xs font-medium text-gray-600">
                                                        {option.previewLabel}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-gray-900 mb-1">
                                                        {option.title}
                                                    </div>
                                                    <div className="text-xs text-gray-600 leading-relaxed">
                                                        {option.description}
                                                    </div>
                                                </div>
                                            </div>
                                        </Radio>
                                    </Card>
                                ))}
                            </Space>
                        </Radio.Group>
                    </div>
                </div>
            </Skeleton>
        </Modal>
    );
};

export default GenerateExposeModal;
