import React, { useState, useEffect, useMemo } from "react";
import { router } from "@inertiajs/react";
import {
    Modal,
    Button,
    Alert,
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
import type { DeveloperProjectUnitType } from "../../Types/developerProject";
import {
    type ExposeValidationWarning,
} from "@/lib/expose/formatExposeValidationLabel";
import ExposeValidationWarnings from "@/Features/Expose/ExposeValidationWarnings";

interface GenerateUnitTypeExposeModalProps {
    open: boolean;
    onClose: () => void;
    projectId: number;
    projectName: string;
    unitType: DeveloperProjectUnitType;
}

interface ExposePayload {
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

const sanitizeFilePart = (value?: string, fallback = "na") => {
    const cleaned = (value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return cleaned || fallback;
};

const GenerateUnitTypeExposeModal: React.FC<
    GenerateUnitTypeExposeModalProps
> = ({ open, onClose, projectId, projectName, unitType }) => {
    const [warnings, setWarnings] = useState<ExposeValidationWarning[]>([]);
    const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
    const [leadSearch, setLeadSearch] = useState<string>("");
    const [clientName, setClientName] = useState<string>("");
    const [phase, setPhase] = useState<Phase>("form");
    const [jobId, setJobId] = useState<number | null>(null);
    const [jobStatus, setJobStatus] = useState<ExposeJobStatus | null>(null);
    const [queuedAt, setQueuedAt] = useState<number | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string>("");

    const baseUrl = `/account/developer-projects/${projectId}/unit-types/${unitType.id}`;

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

    const buildDownloadFileName = () => {
        const chosenClientName =
            clientName.trim() ||
            selectedLead?.client_name ||
            selectedLead?.company_name ||
            "client";

        const safeClient = sanitizeFilePart(chosenClientName, "client");
        const safeProject = sanitizeFilePart(projectName, "project");
        const safeUnit = sanitizeFilePart(
            unitType.display_label ?? unitType.property_type ?? undefined,
            `unit-${unitType.id}`,
        );

        return `${safeClient}-${safeProject}-${safeUnit}-expose.pdf`;
    };

    const isGenerationInProgress = phase === "queued" || isSubmitting;

    useExposeJobPoller({
        jobId,
        onStatusChange: setJobStatus,
        onReady: (downloadUrl) => {
            setPhase("ready");
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = buildDownloadFileName();
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
    }, [open, unitType.id]);

    const handleGenerate = () => {
        const payload: ExposePayload = { layout: "expose-template" };
        const resolvedClientName =
            clientName.trim() ||
            selectedLead?.client_name ||
            selectedLead?.company_name ||
            "";

        if (resolvedClientName) {
            payload.client_name = resolvedClientName;
        }

        generateExpose(payload, {
            onSuccess: (response) => {
                const id = response?.data?.job_id;
                if (id) {
                    setJobId(id);
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

    const handleFixNavigate = (href: string) => {
        onClose();
        router.visit(href);
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
            title={`Generate Expose — ${unitType.display_label ?? unitType.property_type ?? "Unit Type"}`}
            open={open}
            onCancel={handleClose}
            footer={footer}
            width={560}
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
                    <div className="flex flex-col gap-y-5">
                        {warnings.length > 0 && (
                            <Alert
                                message={
                                    hasErrors
                                        ? "Missing Required Information"
                                        : "Missing Information"
                                }
                                description={
                                    <ExposeValidationWarnings
                                        warnings={warnings}
                                        onNavigate={handleFixNavigate}
                                    />
                                }
                                type={hasErrors ? "error" : "warning"}
                                showIcon
                                icon={<WarningOutlined />}
                            />
                        )}

                        <div className="text-sm text-gray-600">
                            This will generate an expose PDF for{" "}
                            <strong>
                                {unitType.display_label ??
                                    unitType.property_type ??
                                    "this unit type"}
                            </strong>{" "}
                            in <strong>{projectName}</strong>. The validation
                            below highlights missing unit-type or project data
                            (such as unit description, location
                            infrastructure/airports, footer image, or outro
                            details) that may otherwise be inherited from the
                            project or left out of the PDF.
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
                                                Select a lead to personalize the
                                                expose. If not found, enter a
                                                custom client name.
                                            </p>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Lead
                                                </label>
                                                <Select
                                                    style={{ width: "100%" }}
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
                                                            (selected?.client_name ||
                                                                selected?.company_name) &&
                                                            !clientName.trim()
                                                        ) {
                                                            setClientName(
                                                                selected.client_name ||
                                                                    selected.company_name ||
                                                                    "",
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

export default GenerateUnitTypeExposeModal;
