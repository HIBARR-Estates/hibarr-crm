import React, { useState, useEffect } from "react";
import { Modal, Button, Alert, Radio, Space, Card, Spin, message } from "antd";
import { FilePdfOutlined, WarningOutlined } from "@ant-design/icons";
import axios from "axios";

interface GenerateExposeModalProps {
    open: boolean;
    onClose: () => void;
    propertyId: number;
}

const GenerateExposeModal: React.FC<GenerateExposeModalProps> = ({
    open,
    onClose,
    propertyId,
}) => {
    const [loading, setLoading] = useState(false);
    const [validating, setValidating] = useState(false);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [layout, setLayout] = useState<
        "vertical_standard" | "horizontal_premium"
    >("vertical_standard");

    useEffect(() => {
        if (open) {
            validateExpose();
        }
    }, [open, propertyId]);

    const validateExpose = async () => {
        setValidating(true);
        setWarnings([]);
        try {
            const response = await axios.post(
                route("properties.expose.validate", propertyId)
            );
            if (response.data.warnings) {
                setWarnings(response.data.warnings);
            }
        } catch (error) {
            console.error(error);
            message.error("Failed to validate expose configuration");
        } finally {
            setValidating(false);
        }
    };

    const handleGenerate = () => {
        setLoading(true);

        // Construct URL
        const url = route("properties.expose.generate", {
            id: propertyId,
            layout,
        });

        // Trigger download
        window.open(url, "_blank");

        setLoading(false);
        onClose();
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
                    loading={loading}
                    onClick={handleGenerate}
                    disabled={validating}
                >
                    Generate PDF
                </Button>,
            ]}
            width={600}
        >
            {validating ? (
                <div className="text-center py-8">
                    <Spin tip="Validating property data..." />
                </div>
            ) : (
                <div className="space-y-6">
                    {warnings.length > 0 && (
                        <Alert
                            message="Missing Information"
                            description={
                                <ul className="list-disc pl-4 mt-2">
                                    {warnings.map((warning, index) => (
                                        <li key={index}>{warning}</li>
                                    ))}
                                </ul>
                            }
                            type="warning"
                            showIcon
                            icon={<WarningOutlined />}
                            className="mb-4"
                        />
                    )}

                    <div>
                        <h3 className="text-lg font-medium mb-3">
                            Select Layout
                        </h3>
                        <Radio.Group
                            value={layout}
                            onChange={(e) => setLayout(e.target.value)}
                            className="w-full"
                        >
                            <Space direction="vertical" className="w-full">
                                <Radio
                                    value="vertical_standard"
                                    className="w-full"
                                >
                                    <Card
                                        size="small"
                                        className="w-full cursor-pointer hover:border-blue-500 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-16 bg-gray-200 border border-gray-300 flex items-center justify-center text-xs text-gray-500">
                                                Vertical
                                            </div>
                                            <div>
                                                <div className="font-medium">
                                                    Vertical - Standard
                                                </div>
                                                <div className="text-gray-500 text-sm">
                                                    Classic portrait layout
                                                    suitable for printing.
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </Radio>
                                <Radio
                                    value="horizontal_premium"
                                    className="w-full"
                                >
                                    <Card
                                        size="small"
                                        className="w-full cursor-pointer hover:border-blue-500 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-12 bg-gray-200 border border-gray-300 flex items-center justify-center text-xs text-gray-500">
                                                Horizontal
                                            </div>
                                            <div>
                                                <div className="font-medium">
                                                    Horizontal - Premium
                                                </div>
                                                <div className="text-gray-500 text-sm">
                                                    Modern landscape layout
                                                    optimized for screens.
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </Radio>
                            </Space>
                        </Radio.Group>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default GenerateExposeModal;
