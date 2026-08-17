import React, { useEffect, useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import {
    Modal,
    Button,
    Select,
    Input,
    Alert,
    Space,
    Typography,
    App,
} from "antd";
import {
    LinkOutlined,
    CopyOutlined,
    ExportOutlined,
    CheckCircleOutlined,
    UserOutlined,
} from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiSuccessResponse } from "@/lib/api/types";
import { useFormData } from "@/Hooks/useFormData";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { PageProps } from "@/Components/DashboardLayout";

const { Text, Paragraph } = Typography;

export type ShareExposeEntityType =
    | "developer_project"
    | "unit_type"
    | "property";

interface ShareExposeLinkModalProps {
    open: boolean;
    onClose: () => void;
    entityType: ShareExposeEntityType;
    entityId: number;
    unitTypeId?: number;
    title: string;
    subtitle?: string;
    /** When set (e.g. from a Deal), lead picker is locked. */
    leadId?: number;
    leadLabel?: string;
}

interface LeadOption {
    id: number;
    client_name?: string;
    company_name?: string;
}

interface SharePayload {
    entity_type: ShareExposeEntityType;
    entity_id: number;
    lead_id: number;
    unit_type_id?: number;
}

interface ShareResult {
    token: string;
    share_url: string;
    snapshot_id: number;
    warnings?: unknown[];
}

type Phase = "form" | "success" | "error";

const ShareExposeLinkModal: React.FC<ShareExposeLinkModalProps> = ({
    open,
    onClose,
    entityType,
    entityId,
    unitTypeId,
    title,
    subtitle,
    leadId: lockedLeadId,
    leadLabel: lockedLeadLabel,
}) => {
    const { td } = useTd();
    const { message } = App.useApp();
    const { props } = usePage<PageProps>();
    const agentName = props.auth?.user?.name ?? td("You", { source: "en" });

    const [phase, setPhase] = useState<Phase>("form");
    const [selectedLeadId, setSelectedLeadId] = useState<number | null>(
        lockedLeadId ?? null,
    );
    const [leadSearch, setLeadSearch] = useState("");
    const [shareUrl, setShareUrl] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const leadPickerLocked = lockedLeadId != null;

    const { data: leads, loading: isLoadingLeads } = useFormData<LeadOption>(
        "leads",
        {
            per_page: 50,
            paginate: false,
            search: leadSearch,
            enabled: open && !leadPickerLocked,
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

    const selectedLeadLabel = useMemo(() => {
        if (leadPickerLocked) {
            return lockedLeadLabel || `Lead #${lockedLeadId}`;
        }
        const selected = normalizedLeads.find(
            (lead) => lead.id === selectedLeadId,
        );
        return (
            selected?.client_name ||
            selected?.company_name ||
            (selectedLeadId ? `Lead #${selectedLeadId}` : "")
        );
    }, [
        leadPickerLocked,
        lockedLeadLabel,
        lockedLeadId,
        normalizedLeads,
        selectedLeadId,
    ]);

    const { mutate: createShare, isPending: isCreating } = useApiMutate<
        SharePayload,
        ShareResult,
        ApiSuccessResponse<ShareResult>
    >(route("expose-snapshots.share"), "POST");

    useEffect(() => {
        if (!open) {
            return;
        }

        setPhase("form");
        setSelectedLeadId(lockedLeadId ?? null);
        setLeadSearch("");
        setShareUrl("");
        setErrorMessage("");
    }, [open, lockedLeadId, entityType, entityId, unitTypeId]);

    const handleCreate = () => {
        if (!selectedLeadId) {
            return;
        }

        setErrorMessage("");

        const payload: SharePayload = {
            entity_type: entityType,
            entity_id: entityId,
            lead_id: selectedLeadId,
        };

        if (entityType === "unit_type" && unitTypeId) {
            payload.unit_type_id = unitTypeId;
        }

        createShare(payload, {
            suppressSuccessToast: true,
            onSuccess: (response) => {
                if (response?.status !== "success" || !response.data?.share_url) {
                    setPhase("error");
                    setErrorMessage(
                        response?.message ||
                            td("Failed to create share link.", { source: "en" }),
                    );
                    return;
                }

                setShareUrl(response.data.share_url);
                setPhase("success");
            },
            onError: (error: unknown) => {
                setPhase("error");
                const err = error as {
                    message?: string;
                    errors?: Record<string, string[]>;
                };
                const firstFieldError = err?.errors
                    ? Object.values(err.errors)[0]?.[0]
                    : undefined;
                setErrorMessage(
                    firstFieldError ||
                        err?.message ||
                        td("Failed to create share link.", { source: "en" }),
                );
            },
        });
    };

    const handleCopy = async () => {
        if (!shareUrl) {
            return;
        }

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(shareUrl);
            } else {
                const textarea = document.createElement("textarea");
                textarea.value = shareUrl;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
            }
            message.success(td("Link copied", { source: "en" }));
        } catch {
            message.error(td("Failed to copy link", { source: "en" }));
        }
    };

    const handleOpen = () => {
        if (!shareUrl) {
            return;
        }
        window.open(shareUrl, "_blank", "noopener,noreferrer");
    };

    const handleClose = () => {
        if (isCreating) {
            return;
        }
        onClose();
    };

    const canSubmit = !!selectedLeadId && !isCreating;

    const footer =
        phase === "success"
            ? [
                  <Button key="done" type="primary" onClick={handleClose}>
                      {td("Done", { source: "en" })}
                  </Button>,
              ]
            : [
                  <Button key="cancel" onClick={handleClose} disabled={isCreating}>
                      {td("Cancel", { source: "en" })}
                  </Button>,
                  <Button
                      key="create"
                      type="primary"
                      icon={<LinkOutlined />}
                      loading={isCreating}
                      disabled={!canSubmit}
                      onClick={handleCreate}
                  >
                      {phase === "error"
                          ? td("Retry", { source: "en" })
                          : td("Create link", { source: "en" })}
                  </Button>,
              ];

    return (
        <Modal
            title={
                <div>
                    <div className="font-semibold">
                        {td("Share exposé", { source: "en" })}
                    </div>
                    <div className="text-sm font-normal text-gray-500 mt-0.5">
                        {title}
                        {subtitle ? ` · ${subtitle}` : ""}
                    </div>
                </div>
            }
            open={open}
            onCancel={handleClose}
            footer={footer}
            width={520}
            destroyOnClose
            maskClosable={!isCreating}
            closable={!isCreating}
            keyboard={!isCreating}
        >
            {phase === "success" ? (
                <div className="flex flex-col gap-4 py-2">
                    <div className="flex items-start gap-3">
                        <CheckCircleOutlined className="text-2xl text-green-500 mt-0.5" />
                        <div>
                            <Text strong>
                                {td("Link ready", { source: "en" })}
                            </Text>
                            {selectedLeadLabel && (
                                <Paragraph type="secondary" className="!mb-0 !mt-1">
                                    {td("Exposé for", { source: "en" })}{" "}
                                    {selectedLeadLabel}
                                </Paragraph>
                            )}
                        </div>
                    </div>

                    <Input.TextArea
                        value={shareUrl}
                        readOnly
                        autoSize={{ minRows: 2, maxRows: 3 }}
                        onFocus={(e) => e.target.select()}
                    />

                    <Space wrap>
                        <Button
                            type="primary"
                            icon={<CopyOutlined />}
                            onClick={handleCopy}
                        >
                            {td("Copy link", { source: "en" })}
                        </Button>
                        <Button icon={<ExportOutlined />} onClick={handleOpen}>
                            {td("Open", { source: "en" })}
                        </Button>
                    </Space>

                    <Text type="secondary" className="text-sm">
                        {td(
                            "Anyone with this link can view this personalized exposé.",
                            { source: "en" },
                        )}
                    </Text>
                </div>
            ) : (
                <div className="flex flex-col gap-5">
                    {phase === "error" && errorMessage && (
                        <Alert type="error" showIcon message={errorMessage} />
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {td("Recipient lead", { source: "en" })}{" "}
                            <span className="text-red-500">*</span>
                        </label>
                        {leadPickerLocked ? (
                            <Input
                                value={selectedLeadLabel}
                                disabled
                                prefix={<UserOutlined className="text-gray-400" />}
                            />
                        ) : (
                            <Select
                                style={{ width: "100%" }}
                                showSearch
                                allowClear
                                placeholder={td("Search and select a lead", {
                                    source: "en",
                                })}
                                options={leadOptions}
                                loading={isLoadingLeads}
                                value={selectedLeadId ?? undefined}
                                onChange={(value) =>
                                    setSelectedLeadId(
                                        typeof value === "number" ? value : null,
                                    )
                                }
                                onSearch={setLeadSearch}
                                filterOption={false}
                            />
                        )}
                    </div>

                    <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                        <span className="text-gray-500">
                            {td("Agent", { source: "en" })}:
                        </span>{" "}
                        <span className="font-medium text-gray-800">
                            {agentName}
                        </span>{" "}
                        <span className="text-gray-400">
                            ({td("you", { source: "en" })})
                        </span>
                    </div>

                    <Paragraph type="secondary" className="!mb-0 text-sm">
                        {td(
                            "Creates a personalized shareable link for the digital exposé. The recipient opens it in the exposé app.",
                            { source: "en" },
                        )}
                    </Paragraph>
                </div>
            )}
        </Modal>
    );
};

export default ShareExposeLinkModal;
