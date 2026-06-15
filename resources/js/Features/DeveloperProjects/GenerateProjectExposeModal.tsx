import React, { useState, useEffect } from "react";
import { Modal, Button, Alert, Skeleton, Collapse, Input, Spin } from "antd";
import {
    FilePdfOutlined,
    WarningOutlined,
    UserOutlined,
    MailOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
} from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { useExposeJobPoller } from "@/lib/api/client/useExposeJobPoller";
import { ApiResponse } from "@/lib/api/types";
import {
    formatExposeValidationLabel,
    type ExposeValidationWarning,
} from "@/lib/expose/formatExposeValidationLabel";

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

interface GenerateJobResponse {
    job_id: number;
}

type Phase = "form" | "queued" | "ready" | "failed";

interface ValidationData {
    warnings: ExposeValidationWarning[];
}

const GenerateProjectExposeModal: React.FC<GenerateProjectExposeModalProps> = ({
    open,
    onClose,
    projectId,
    projectName,
}) => {
    const [warnings, setWarnings] = useState<ExposeValidationWarning[]>([]);
    const [clientName, setClientName] = useState<string>("");
    const [clientEmail, setClientEmail] = useState<string>("");
    const [phase, setPhase] = useState<Phase>("form");
    const [jobId, setJobId] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>("");

    const baseUrl = `/account/developer-projects/${projectId}`;

    const { mutate: validateExpose, isPending: isValidating } = useApiMutate<
        Record<string, never>,
        ValidationData,
        ApiResponse<ValidationData>
    >(`${baseUrl}/expose/validate`, "POST");

    const { mutate: generateExpose, isPending: isSubmitting } = useApiMutate<
        ExposePayload,
        GenerateJobResponse,
        ApiResponse<GenerateJobResponse>
    >(`${baseUrl}/expose/generate`, "POST");

    useExposeJobPoller({
        jobId,
        onReady: (downloadUrl) => {
            setPhase("ready");
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = `${projectName}-project-brochure.pdf`;
            link.click();
        },
        onError: (message) => {
            setPhase("failed");
            setErrorMessage(message);
        },
    });

    useEffect(() => {
        if (open) {
            setPhase("form");
            setJobId(null);
            setErrorMessage("");
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
        if (clientName.trim()) payload.client_name = clientName.trim();
        if (clientEmail.trim()) payload.client_email = clientEmail.trim();

        generateExpose(payload, {
            onSuccess: (response) => {
                const id = response?.data?.job_id;
                if (id) {
                    setJobId(id);
                    setPhase("queued");
                }
            },
            onError: () => {
                setPhase("failed");
                setErrorMessage("Failed to queue brochure generation.");
            },
        });
    };

    const handleClose = () => {
        setPhase("form");
        setJobId(null);
        onClose();
    };

    const hasErrors = warnings.some((w) => w.severity === "error");

    const footer =
        phase === "form" || phase === "failed"
            ? [
                  <Button key="cancel" onClick={handleClose}>
                      Cancel
                  </Button>,
                  <Button
                      key="generate"
                      type="primary"
                      icon={<FilePdfOutlined />}
                      loading={isSubmitting}
                      onClick={handleGenerate}
                      disabled={isValidating || hasErrors || isSubmitting}
                  >
                      {phase === "failed" ? "Retry" : "Generate Brochure PDF"}
                  </Button>,
              ]
            : [
                  <Button key="close" onClick={handleClose}>
                      {phase === "ready" ? "Done" : "Close"}
                  </Button>,
              ];

    return (
        <Modal
            title={`Generate Project Brochure — ${projectName}`}
            open={open}
            onCancel={handleClose}
            footer={footer}
            width={560}
            destroyOnClose
        >
            {phase === "queued" && (
                <div className="py-10 text-center flex flex-col items-center gap-4">
                    <Spin size="large" />
                    <p className="text-gray-600">
                        Your brochure PDF is being generated. You can close this
                        window — a notification will appear when it's ready.
                    </p>
                </div>
            )}
            {phase === "ready" && (
                <div className="py-8 text-center flex flex-col items-center gap-3">
                    <CheckCircleOutlined className="text-4xl text-green-500" />
                    <p className="text-gray-700 font-medium">
                        Your PDF is ready! The download should start
                        automatically.
                    </p>
                </div>
            )}
            {phase === "failed" && (
                <Alert
                    type="error"
                    showIcon
                    icon={<CloseCircleOutlined />}
                    message="Generation Failed"
                    description={errorMessage}
                    className="mb-4"
                />
            )}
            {(phase === "form" || phase === "failed") && (
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
                                                <strong>
                                                    {formatExposeValidationLabel(
                                                        warning,
                                                    )}
                                                    :
                                                </strong>{" "}
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
                            overview, facilities, unit type summaries, payment
                            plan, and infrastructure distances.
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
                                                Add client details to
                                                personalize the PDF.
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
            )}
        </Modal>
    );
};

export default GenerateProjectExposeModal;
