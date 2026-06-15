import React, { useEffect, useMemo, useState } from "react";
import {
    Modal,
    Button,
    Alert,
    Radio,
    Space,
    Card,
    Skeleton,
    Collapse,
    Input,
    Spin,
    Select,
} from "antd";
import {
    FilePdfOutlined,
    WarningOutlined,
    UserOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
} from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import {
    useExposeJobPoller,
    exposeJobStatusLabel,
    formatExposeElapsed,
    type ExposeJobStatus,
} from "@/lib/api/client/useExposeJobPoller";
import { ApiResponse } from "@/lib/api/types";
import { useFormData } from "@/Hooks/useFormData";
import {
    formatExposeValidationLabel,
    type ExposeValidationWarning,
} from "@/lib/expose/formatExposeValidationLabel";

interface GenerateExposeModalProps {
    open: boolean;
    onClose: () => void;
    propertyId: number;
    projectName?: string;
    unitName?: string;
}

interface ExposeGeneratePayload {
    layout: string;
    client_name?: string;
}

interface GenerateJobResponse {
    job_id: number;
}

type Phase = "form" | "queued" | "ready" | "failed";

interface ValidationData {
    warnings: ExposeValidationWarning[];
}

interface LeadOption {
    id: number;
    client_name?: string;
    company_name?: string;
}

interface LayoutOption {
    value: string;
    title: string;
    description: string;
    previewWidth: string;
    previewHeight: string;
    previewLabel: string;
}

const LAYOUT_OPTIONS: LayoutOption[] = [
    {
        value: "expose-template",
        title: "Expose Template",
        description:
            "A customizable template designed for showcasing properties in a professional format.",
        previewWidth: "w-16",
        previewHeight: "h-12",
        previewLabel: "Horizontal",
    },
];

const sanitizeFilePart = (value?: string, fallback = "na") => {
    const cleaned = (value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return cleaned || fallback;
};

const GenerateExposeModal: React.FC<GenerateExposeModalProps> = ({
    open,
    onClose,
    propertyId,
    projectName,
    unitName,
}) => {
    const [warnings, setWarnings] = useState<ExposeValidationWarning[]>([]);
    const [layout, setLayout] = useState<string>("expose-template");
    const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
    const [leadSearch, setLeadSearch] = useState<string>("");
    const [clientName, setClientName] = useState<string>("");
    const [phase, setPhase] = useState<Phase>("form");
    const [jobId, setJobId] = useState<number | null>(null);
    const [jobStatus, setJobStatus] = useState<ExposeJobStatus | null>(null);
    const [queuedAt, setQueuedAt] = useState<number | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string>("");

    const { mutate: validateExpose, isPending: isValidating } = useApiMutate<
        Record<string, never>,
        ValidationData,
        ApiResponse<ValidationData>
    >(`/account/properties/${propertyId}/expose/validate`, "POST");

    const { mutate: generateExpose, isPending: isSubmitting } = useApiMutate<
        ExposeGeneratePayload,
        GenerateJobResponse,
        ApiResponse<GenerateJobResponse>
    >(`/account/properties/${propertyId}/expose/generate`, "POST");

    const { data: leads, loading: isLoadingLeads } = useFormData<LeadOption>(
        "leads",
        {
            per_page: 50,
            paginate: false,
            search: leadSearch,
            enabled: open,
        },
    );

    const normalizedLeads = useMemo(
        () => (Array.isArray(leads) ? leads : []),
        [leads],
    );

    const leadOptions = useMemo(
        () =>
            normalizedLeads.map((lead) => ({
                value: lead.id,
                label:
                    lead.client_name || lead.company_name || `Lead #${lead.id}`,
            })),
        [normalizedLeads],
    );

    const selectedLead = useMemo(
        () => normalizedLeads.find((lead) => lead.id === selectedLeadId),
        [normalizedLeads, selectedLeadId],
    );

    const buildDownloadFileName = (backendFilename?: string) => {
        const chosenClientName =
            clientName.trim() || selectedLead?.client_name || "client";

        const safeClient = sanitizeFilePart(chosenClientName, "client");
        const safeProject = sanitizeFilePart(projectName, "project");
        const safeUnit = sanitizeFilePart(unitName, `unit-${propertyId}`);

        return (
            `${safeClient}-${safeProject}-${safeUnit}-expose.pdf` ||
            backendFilename ||
            `property-expose-${propertyId}.pdf`
        );
    };

    const isGenerationInProgress = phase === "queued" || isSubmitting;

    useExposeJobPoller({
        jobId,
        onStatusChange: setJobStatus,
        onReady: (downloadUrl, backendFilename) => {
            setPhase("ready");
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = buildDownloadFileName(backendFilename);
            link.click();
        },
        onError: (message) => {
            setPhase("failed");
            setErrorMessage(message);
        },
    });

    useEffect(() => {
        if (phase !== "queued" || !queuedAt) {
            setElapsedSeconds(0);
            return;
        }

        const updateElapsed = () => {
            setElapsedSeconds(Math.floor((Date.now() - queuedAt) / 1000));
        };

        updateElapsed();
        const timer = window.setInterval(updateElapsed, 1000);

        return () => window.clearInterval(timer);
    }, [phase, queuedAt]);

    useEffect(() => {
        if (open) {
            setPhase("form");
            setJobId(null);
            setJobStatus(null);
            setQueuedAt(null);
            setElapsedSeconds(0);
            setErrorMessage("");
            setWarnings([]);
            setSelectedLeadId(null);
            setLeadSearch("");
            setClientName("");
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
    }, [open, propertyId]);

    const handleGenerate = () => {
        const payload: ExposeGeneratePayload = { layout };
        const resolvedClientName =
            clientName.trim() || selectedLead?.client_name || "";

        if (resolvedClientName) {
            payload.client_name = resolvedClientName;
        }

        generateExpose(payload, {
            onSuccess: (response) => {
                const queuedJobId = response?.data?.job_id;
                if (queuedJobId) {
                    setJobId(queuedJobId);
                    setJobStatus("queued");
                    setQueuedAt(Date.now());
                    setPhase("queued");
                }
            },
            onError: () => {
                setPhase("failed");
                setErrorMessage("Failed to queue expose generation.");
            },
        });
    };

    const handleClose = () => {
        if (isGenerationInProgress) {
            return;
        }

        setPhase("form");
        setJobId(null);
        setJobStatus(null);
        setQueuedAt(null);
        onClose();
    };

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
                      disabled={isValidating || isSubmitting}
                  >
                      {phase === "failed" ? "Retry" : "Generate PDF"}
                  </Button>,
              ]
            : [
                  <Button key="close" onClick={handleClose}>
                      {phase === "ready" ? "Done" : "Close"}
                  </Button>,
              ];

    return (
        <Modal
            title="Generate Expose PDF"
            open={open}
            onCancel={handleClose}
            footer={footer}
            width={600}
            destroyOnClose
            maskClosable={!isGenerationInProgress}
            closable={!isGenerationInProgress}
            keyboard={!isGenerationInProgress}
        >
            {phase === "queued" && (
                <div className="py-10 text-center flex flex-col items-center gap-4">
                    <Spin size="large" />
                    <p className="text-gray-700 font-medium">
                        {exposeJobStatusLabel(jobStatus)}
                    </p>
                    <p className="text-gray-500 text-sm">
                        Elapsed: {formatExposeElapsed(elapsedSeconds)}
                    </p>
                    <p className="text-gray-600 text-sm max-w-sm">
                        Large exposes with many photos can take a few minutes.
                        You can keep this window open or close it — we will
                        notify you when the PDF is ready.
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
                    <div className="flex flex-col gap-y-6">
                        {warnings.length > 0 && (
                            <Alert
                                message="Missing Information"
                                description={
                                    <ul className="list-disc pl-4 mt-2">
                                        {warnings.map((warning, index) => (
                                            <li key={index}>
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
                                <Space
                                    direction="horizontal"
                                    size="middle"
                                    className="w-full flex"
                                >
                                    {LAYOUT_OPTIONS.map((option) => (
                                        <Card
                                            key={option.value}
                                            size="small"
                                            className={`flex-1 cursor-pointer h-48 transition-all duration-200 ${
                                                layout === option.value
                                                    ? "border-blue-500bg-blue-50"
                                                    : "border-gray-200 hover:border-blue-400"
                                            }`}
                                            onClick={() =>
                                                setLayout(option.value)
                                            }
                                        >
                                            <Radio
                                                value={option.value}
                                                className="w-full"
                                            >
                                                <div className="flex flex-col items-center gap-3 text-center">
                                                    <div
                                                        className={`${option.previewWidth} ${option.previewHeight} bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-300 rounded flex items-center justify-center`}
                                                    >
                                                        <span className="text-xs font-medium text-gray-600">
                                                            {
                                                                option.previewLabel
                                                            }
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

                        <Collapse
                            ghost
                            items={[
                                {
                                    key: "personalization",
                                    label: (
                                        <span className="text-base font-semibold text-gray-800">
                                            Personalization (Optional)
                                        </span>
                                    ),
                                    children: (
                                        <div className="flex flex-col gap-4">
                                            <p className="text-sm text-gray-600 mb-2">
                                                Select a lead to personalize the
                                                expose. If not found, enter a
                                                custom client name.
                                            </p>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Lead
                                                </label>
                                                <Select
                                                    showSearch
                                                    allowClear
                                                    placeholder="Search and select a lead"
                                                    options={leadOptions}
                                                    loading={isLoadingLeads}
                                                    value={
                                                        selectedLeadId ??
                                                        undefined
                                                    }
                                                    onChange={(value) => {
                                                        const nextLeadId =
                                                            typeof value ===
                                                            "number"
                                                                ? value
                                                                : null;

                                                        setSelectedLeadId(
                                                            nextLeadId,
                                                        );

                                                        if (
                                                            nextLeadId === null
                                                        ) {
                                                            return;
                                                        }

                                                        const selected =
                                                            normalizedLeads.find(
                                                                (lead) =>
                                                                    lead.id ===
                                                                    nextLeadId,
                                                            );

                                                        if (
                                                            selected?.client_name &&
                                                            !clientName.trim()
                                                        ) {
                                                            setClientName(
                                                                selected.client_name,
                                                            );
                                                        }
                                                    }}
                                                    onSearch={setLeadSearch}
                                                    filterOption={false}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Client Name (Optional)
                                                </label>
                                                <Input
                                                    placeholder="Enter client name if not found"
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

export default GenerateExposeModal;
