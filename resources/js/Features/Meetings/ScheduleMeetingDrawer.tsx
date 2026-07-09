import React, { useState, useEffect } from "react";
import { router } from "@inertiajs/react";
import { Modal, Select, Spin, Segmented, Alert } from "antd";
import {
    CalendarOutlined,
    FundProjectionScreenOutlined,
    UserOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import "./schedule-meeting-modal.css";

import SaveFollowup, {
    SaveFollowupFormData,
} from "@/Pages/Deals/Components/Tabs/followups/SaveFollowup";
import MeetingSuccessStep from "@/Pages/Deals/Components/Tabs/followups/MeetingSuccessStep";
import { Deal } from "@/Types/api/deals";
import { Lead } from "@/Types/api/leads";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import useTranslation from "@/Hooks/useTranslation";

type EntityType = "deal" | "lead";

const FORM_ID = "schedule-meeting-modal-form";

interface SuccessData {
    entityName: string;
    typeName: string;
    date: string;
    time: string;
    duration?: number | null;
    location: string;
}

export interface ScheduleMeetingDrawerProps {
    open: boolean;
    onClose: () => void;
    userDeals: { id: number; name: string }[];
    userLeads?: { id: number; name: string }[];
    onSuccess?: () => void;
}

export default function ScheduleMeetingDrawer({
    open,
    onClose,
    userDeals,
    userLeads = [],
    onSuccess,
}: ScheduleMeetingDrawerProps) {
    const { t } = useTranslation();
    const [entityType, setEntityType] = useState<EntityType>("deal");
    const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
    const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [dealsForLead, setDealsForLead] = useState<{ id: number; name: string }[]>([]);
    const [loadingEntity, setLoadingEntity] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [formKey, setFormKey] = useState(0);
    const [step, setStep] = useState<"form" | "success">("form");
    const [meetingTypeName, setMeetingTypeName] = useState("");
    const [successData, setSuccessData] = useState<SuccessData | null>(null);

    const hasDeals = userDeals.length > 0;
    const hasLeads = userLeads.length > 0;

    const resetSelection = () => {
        setSelectedDealId(null);
        setSelectedLeadId(null);
        setSelectedDeal(null);
        setSelectedLead(null);
        setDealsForLead([]);
    };

    useEffect(() => {
        if (open) {
            resetSelection();
            setErrors([]);
            setStep("form");
            setMeetingTypeName("");
            setSuccessData(null);
            setFormKey((prev) => prev + 1);
            setEntityType(hasDeals ? "deal" : hasLeads ? "lead" : "deal");
        }
    }, [open, hasDeals, hasLeads]);

    useEffect(() => {
        if (entityType !== "deal" || !selectedDealId) {
            if (entityType === "deal") setSelectedDeal(null);
            return;
        }
        setLoadingEntity(true);
        setErrors([]);
        fetch(`/account/meetings/deal/${selectedDealId}`, {
            headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        })
            .then((res) => res.json())
            .then((json) => {
                if (json.success) setSelectedDeal(json.data);
                else setErrors([t("pages.meetings.schedule.failed_to_load")]);
            })
            .catch(() => setErrors([t("pages.meetings.schedule.failed_to_load")]))
            .finally(() => setLoadingEntity(false));
    }, [selectedDealId, entityType, t]);

    useEffect(() => {
        if (entityType !== "lead" || !selectedLeadId) {
            if (entityType === "lead") {
                setSelectedLead(null);
                setDealsForLead([]);
            }
            return;
        }
        setLoadingEntity(true);
        setErrors([]);
        fetch(`/account/meetings/lead/${selectedLeadId}`, {
            headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        })
            .then((res) => res.json())
            .then((json) => {
                if (json.success) {
                    setSelectedLead(json.data);
                    setDealsForLead(json.deals_for_lead ?? []);
                } else {
                    setErrors([t("pages.meetings.schedule.failed_to_load_lead")]);
                }
            })
            .catch(() => setErrors([t("pages.meetings.schedule.failed_to_load_lead")]))
            .finally(() => setLoadingEntity(false));
    }, [selectedLeadId, entityType, t]);

    const handleEntityTypeChange = (value: EntityType) => {
        setEntityType(value);
        resetSelection();
        setErrors([]);
        setFormKey((prev) => prev + 1);
    };

    const handleCancel = () => {
        setErrors([]);
        resetSelection();
        setStep("form");
        setMeetingTypeName("");
        setSuccessData(null);
        onClose();
    };

    const handleDone = () => {
        handleCancel();
        if (onSuccess) {
            onSuccess();
        } else {
            router.reload();
        }
    };

    const handleBookAnother = () => {
        setStep("form");
        resetSelection();
        setErrors([]);
        setMeetingTypeName("");
        setSuccessData(null);
        setFormKey((prev) => prev + 1);
    };

    const { mutate, status } = useApiMutate<
        SaveFollowupFormData,
        null,
        ApiResponse<null>
    >(`/account/deals/follow-up-store`, "POST");

    const submitting = isLoading({ status });

    const onSubmit = (data: SaveFollowupFormData) => {
        const entityName =
            entityType === "deal"
                ? (selectedDeal?.name || "")
                : (selectedLead as any)?.client_name_salutation ||
                  (selectedLead as any)?.client_name ||
                  "";

        mutate(data, {
            onSuccess: () => {
                setErrors([]);
                setSuccessData({
                    entityName,
                    typeName: meetingTypeName,
                    date:     data.next_follow_up_date,
                    time:     data.start_time,
                    duration: data.duration,
                    location: data.location,
                });
                setStep("success");
            },
            onError: (errorResponse: unknown) => {
                const responseErrors = errorFormatter(errorResponse)?.errors || [];
                setErrors(Object.values(responseErrors).flat() as string[]);
            },
        });
    };

    const isEntitySelected =
        entityType === "deal" ? !!selectedDealId : !!selectedLeadId;
    const isFormReady =
        entityType === "deal"
            ? !!selectedDeal && !loadingEntity
            : !!selectedLead && !loadingEntity;

    const entityOptions =
        entityType === "deal"
            ? userDeals.map((d) => ({ value: d.id, label: d.name }))
            : userLeads.map((l) => ({ value: l.id, label: l.name }));

    const showEntityTypePicker = hasDeals && hasLeads;

    return (
        <Modal
            className="schedule-meeting-modal"
            title={null}
            open={open}
            onCancel={handleCancel}
            footer={null}
            width={780}
            centered
            destroyOnHidden
            maskClosable={false}
            closable
        >
            {/* ── Header ── */}
            <div className="px-6 pt-6 pb-5 pr-14 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <CalendarOutlined className="text-blue-600 text-sm" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 leading-tight">
                            {step === "success"
                                ? "Meeting Scheduled!"
                                : t("app.meetings.schedule_drawer_title")}
                        </h2>
                        <p className="mt-0.5 text-sm text-gray-500">
                            {step === "success"
                                ? "Reminders will be sent 1 hr, 30, 15 & 5 min before."
                                : isEntitySelected
                                ? t("pages.meetings.schedule.form_divider")
                                : t("pages.meetings.schedule.select_deal_prompt")}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
                {step === "success" ? (
                    <MeetingSuccessStep
                        onDone={handleDone}
                        onBookAnother={handleBookAnother}
                        hideButtons={true}
                        entityName={successData?.entityName}
                        typeName={successData?.typeName}
                        date={successData?.date}
                        time={successData?.time}
                        duration={successData?.duration}
                        location={successData?.location}
                    />
                ) : (
                    <div className="space-y-5">
                        {!hasDeals && !hasLeads ? (
                            <Alert
                                type="info"
                                showIcon
                                message={t("pages.meetings.schedule.no_entities_available")}
                            />
                        ) : (
                            <>
                                {showEntityTypePicker && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            {t("app.meetings.entity_type_label")}
                                        </label>
                                        <Segmented
                                            block
                                            value={entityType}
                                            onChange={(value) =>
                                                handleEntityTypeChange(value as EntityType)
                                            }
                                            options={[
                                                {
                                                    label: t("app.meetings.entity_type_deal"),
                                                    value: "deal",
                                                    icon: <FundProjectionScreenOutlined />,
                                                    disabled: !hasDeals,
                                                },
                                                {
                                                    label: t("app.meetings.entity_type_lead"),
                                                    value: "lead",
                                                    icon: <UserOutlined />,
                                                    disabled: !hasLeads,
                                                },
                                            ]}
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {entityType === "deal"
                                            ? t("app.meetings.select_deal_label")
                                            : t("app.meetings.select_lead_label")}{" "}
                                        <span className="text-red-500">*</span>
                                    </label>
                                    <Select
                                        showSearch
                                        allowClear
                                        placeholder={
                                            entityType === "deal"
                                                ? t("app.meetings.select_deal_placeholder")
                                                : t("app.meetings.select_lead_placeholder")
                                        }
                                        optionFilterProp="label"
                                        className="w-full"
                                        value={
                                            entityType === "deal"
                                                ? selectedDealId
                                                : selectedLeadId
                                        }
                                        onChange={(val) => {
                                            if (entityType === "deal") {
                                                setSelectedDealId(val ?? null);
                                            } else {
                                                setSelectedLeadId(val ?? null);
                                            }
                                            setErrors([]);
                                        }}
                                        options={entityOptions}
                                        notFoundContent={
                                            entityType === "deal"
                                                ? t("pages.meetings.schedule.no_deals_found")
                                                : t("pages.meetings.schedule.no_leads_found")
                                        }
                                        filterOption={(input, option) =>
                                            (option?.label as string)
                                                ?.toLowerCase()
                                                .includes(input.toLowerCase()) ?? false
                                        }
                                    />
                                </div>
                            </>
                        )}

                        {errors.length > 0 && !isFormReady && (
                            <Alert
                                type="error"
                                showIcon
                                message={errors.join(" ")}
                            />
                        )}

                        {loadingEntity && (
                            <div className="flex justify-center py-10">
                                <Spin
                                    tip={
                                        entityType === "deal"
                                            ? t("pages.meetings.schedule.loading_deal")
                                            : t("pages.meetings.schedule.loading_lead")
                                    }
                                />
                            </div>
                        )}

                        {isFormReady && (
                            <SaveFollowup
                                key={formKey}
                                formId={FORM_ID}
                                hideFooter={true}
                                context={entityType}
                                deal={entityType === "deal" ? selectedDeal! : undefined}
                                lead={entityType === "lead" ? selectedLead! : undefined}
                                dealsForLead={
                                    entityType === "lead" ? dealsForLead : undefined
                                }
                                showLeadEntity={entityType === "lead"}
                                showOptionalDealSelect={
                                    entityType === "lead" && dealsForLead.length > 0
                                }
                                onSubmit={onSubmit}
                                onCancel={handleCancel}
                                loading={submitting}
                                errors={errors}
                                onMeetingTypeNameChange={setMeetingTypeName}
                            />
                        )}

                        {!isEntitySelected && !loadingEntity && (hasDeals || hasLeads) && (
                            <div className="text-center py-12 text-gray-400 rounded-xl border border-dashed border-gray-200 bg-gray-50">
                                {entityType === "deal" ? (
                                    <FundProjectionScreenOutlined className="text-4xl mb-3 block mx-auto text-gray-300" />
                                ) : (
                                    <UserOutlined className="text-4xl mb-3 block mx-auto text-gray-300" />
                                )}
                                <CalendarOutlined className="text-lg mb-2 block mx-auto text-gray-300" />
                                <p className="text-sm mb-0 px-4">
                                    {entityType === "deal"
                                        ? t("pages.meetings.schedule.select_deal_prompt")
                                        : t("pages.meetings.schedule.select_lead_prompt")}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Footer ── */}
            <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-white flex items-center justify-between">
                {step === "success" ? (
                    <>
                        <button
                            onClick={handleBookAnother}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-xl transition-colors shadow-sm"
                        >
                            <PlusOutlined /> Book another meeting
                        </button>
                        <button
                            onClick={handleDone}
                            className="px-5 py-2.5 border border-gray-200 text-gray-600 text-[13px] font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Done
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <div className="flex items-center gap-3">
                            {isFormReady && !submitting && (
                                <p className="text-[11px] text-gray-400 italic">
                                    Complete all required fields to schedule
                                </p>
                            )}
                            <button
                                form={FORM_ID}
                                type="submit"
                                disabled={!isFormReady || submitting}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                    isFormReady && !submitting
                                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 active:scale-[0.98]"
                                        : "bg-gray-100 text-gray-300 cursor-not-allowed"
                                }`}
                            >
                                <CalendarOutlined />
                                {submitting ? "Scheduling…" : "Schedule Meeting"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
}
