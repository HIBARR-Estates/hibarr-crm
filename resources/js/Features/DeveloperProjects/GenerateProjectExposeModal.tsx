import React, { useState, useEffect } from "react";
import {
    Modal,
    Button,
    Alert,
    Skeleton,
    Collapse,
    Input,
} from "antd";
import {
    FilePdfOutlined,
    WarningOutlined,
    UserOutlined,
    MailOutlined,
} from "@ant-design/icons";
import { useFileDownloadMutate } from "@/lib/api/client/useFileDownloadMutate";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiResponse } from "@/lib/api/types";

interface GenerateProjectExposeModalProps {
    open: boolean;
    onClose: () => void;
    projectId: number;
    projectName: string;
}

interface ExposePayload {
    client_name?: string;
    client_email?: string;
}

interface Warning {
    severity: string;
    field: string;
    message: string;
}

interface ValidationData {
    warnings: Warning[];
}

const GenerateProjectExposeModal: React.FC<
    GenerateProjectExposeModalProps
> = ({ open, onClose, projectId, projectName }) => {
    const [warnings, setWarnings] = useState<Warning[]>([]);
    const [clientName, setClientName] = useState<string>("");
    const [clientEmail, setClientEmail] = useState<string>("");

    const baseUrl = `/account/developer-projects/${projectId}`;

    const { mutate: validateExpose, isPending: isValidating } = useApiMutate<
        Record<string, never>,
        ValidationData,
        ApiResponse<ValidationData>
    >(`${baseUrl}/expose/validate`, "POST");

    const { mutate: generateExpose, isPending: isGenerating } =
        useFileDownloadMutate<ExposePayload>(
            `${baseUrl}/expose/generate`,
            "POST",
            {
                filename: `${projectName}-project-brochure.pdf`,
                onSuccess: () => {
                    onClose();
                },
                onError: (error) => {
                    console.error(
                        "Failed to generate project brochure:",
                        error,
                    );
                },
            },
        );

    useEffect(() => {
        if (open) {
            setWarnings([]);
            setClientName("");
            setClientEmail("");
            validateExpose(
                {},
                {
                    onSuccess: (response) => {
                        if (response?.data?.warnings) {
                            setWarnings(response.data.warnings);
                        } else {
                            setWarnings([]);
                        }
                    },
                },
            );
        }
    }, [open, projectId]);

    const handleGenerate = () => {
        const payload: ExposePayload = {};
        if (clientName.trim()) {
            payload.client_name = clientName.trim();
        }
        if (clientEmail.trim()) {
            payload.client_email = clientEmail.trim();
        }
        generateExpose(payload);
    };

    const hasErrors = warnings.some((w) => w.severity === "error");

    return (
        <Modal
            title={`Generate Project Brochure — ${projectName}`}
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
                    disabled={isValidating || hasErrors}
                >
                    Generate Brochure PDF
                </Button>,
            ]}
            width={560}
            destroyOnClose
        >
            <Skeleton loading={isValidating} active>
                <div className="flex flex-col gap-y-5">
                    {warnings.length > 0 && (
                        <Alert
                            message={
                                hasErrors
                                    ? "Missing Required Information"
                                    : "Missing Information"
                            }
                            description={
                                <ul className="list-disc pl-4 mt-2">
                                    {warnings.map((warning, index) => (
                                        <li
                                            key={index}
                                            className={
                                                warning.severity === "error"
                                                    ? "text-red-600"
                                                    : ""
                                            }
                                        >
                                            <strong>{warning.field}:</strong>{" "}
                                            {warning.message}
                                        </li>
                                    ))}
                                </ul>
                            }
                            type={hasErrors ? "error" : "warning"}
                            showIcon
                            icon={<WarningOutlined />}
                        />
                    )}

                    <div className="text-sm text-gray-600">
                        This will generate a project-level brochure PDF for{" "}
                        <strong>{projectName}</strong>, including project
                        overview, facilities, unit type summaries, payment plan,
                        and infrastructure distances.
                    </div>

                    <Collapse
                        ghost
                        items={[
                            {
                                key: "personalization",
                                label: (
                                    <span className="text-sm font-semibold text-gray-800">
                                        Personalization (Optional)
                                    </span>
                                ),
                                children: (
                                    <div className="flex flex-col gap-4">
                                        <p className="text-sm text-gray-500">
                                            Add client details to personalize
                                            the PDF.
                                        </p>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Client Name
                                            </label>
                                            <Input
                                                placeholder="Enter client name"
                                                prefix={
                                                    <UserOutlined className="text-gray-400" />
                                                }
                                                value={clientName}
                                                onChange={(e) =>
                                                    setClientName(
                                                        e.target.value,
                                                    )
                                                }
                                                allowClear
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Client Email
                                            </label>
                                            <Input
                                                placeholder="Enter client email"
                                                prefix={
                                                    <MailOutlined className="text-gray-400" />
                                                }
                                                value={clientEmail}
                                                onChange={(e) =>
                                                    setClientEmail(
                                                        e.target.value,
                                                    )
                                                }
                                                type="email"
                                                allowClear
                                            />
                                        </div>
                                    </div>
                                ),
                            },
                        ]}
                    />
                </div>
            </Skeleton>
        </Modal>
    );
};

export default GenerateProjectExposeModal;
