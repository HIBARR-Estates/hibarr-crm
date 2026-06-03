import React, { useState, useEffect } from "react";
import { router } from "@inertiajs/react";
import { Drawer, Select, Spin } from "antd";
import { CalendarOutlined } from "@ant-design/icons";

import SaveFollowup, {
    SaveFollowupFormData,
} from "@/Pages/Deals/Components/Tabs/followups/SaveFollowup";
import MeetingSuccessStep from "@/Pages/Deals/Components/Tabs/followups/MeetingSuccessStep";
import { Deal } from "@/Types/api/deals";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import useTranslation from "@/Hooks/useTranslation";

export interface ScheduleMeetingDrawerProps {
    open: boolean;
    onClose: () => void;
    userDeals: { id: number; name: string }[];
    onSuccess?: () => void;
}

export default function ScheduleMeetingDrawer({
    open,
    onClose,
    userDeals,
    onSuccess,
}: ScheduleMeetingDrawerProps) {
    const { t } = useTranslation();
    const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
    const [loadingDeal, setLoadingDeal] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [formKey, setFormKey] = useState(0);
    const [step, setStep] = useState<"form" | "success">("form");

    useEffect(() => {
        if (open) {
            setSelectedDealId(null);
            setSelectedDeal(null);
            setErrors([]);
            setStep("form");
            setFormKey((prev) => prev + 1);
        }
    }, [open]);

    useEffect(() => {
        if (!selectedDealId) {
            setSelectedDeal(null);
            return;
        }

        setLoadingDeal(true);
        fetch(`/account/meetings/deal/${selectedDealId}`, {
            headers: {
                Accept: "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
        })
            .then((res) => res.json())
            .then((json) => {
                if (json.success) {
                    setSelectedDeal(json.data);
                }
            })
            .catch(() => {
                setErrors([t("pages.meetings.schedule.failed_to_load")]);
            })
            .finally(() => setLoadingDeal(false));
    }, [selectedDealId, t]);

    const handleCancel = () => {
        setErrors([]);
        setSelectedDealId(null);
        setSelectedDeal(null);
        setStep("form");
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
        setSelectedDealId(null);
        setSelectedDeal(null);
        setErrors([]);
        setFormKey((prev) => prev + 1);
    };

    const { mutate, status } = useApiMutate<
        SaveFollowupFormData,
        null,
        ApiResponse<null>
    >(`/account/deals/follow-up-store`, "POST");

    const onSubmit = (data: SaveFollowupFormData) => {
        mutate(data, {
            onSuccess: () => {
                setErrors([]);
                setStep("success");
            },
            onError: (errorResponse: unknown) => {
                const responseErrors =
                    errorFormatter(errorResponse)?.errors || [];
                setErrors(Object.values(responseErrors).flat() as string[]);
            },
        });
    };

    return (
        <Drawer
            title={t("app.meetings.schedule_drawer_title")}
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
            destroyOnClose
        >
            {step === "success" ? (
                <MeetingSuccessStep
                    onDone={handleDone}
                    onBookAnother={handleBookAnother}
                />
            ) : (
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t("app.meetings.select_deal_label")}{" "}
                            <span className="text-red-500">*</span>
                        </label>
                        <Select
                            showSearch
                            placeholder={t(
                                "app.meetings.select_deal_placeholder",
                            )}
                            optionFilterProp="label"
                            className="w-full"
                            value={selectedDealId}
                            onChange={(val) => setSelectedDealId(val)}
                            options={userDeals.map((d) => ({
                                value: d.id,
                                label: d.name,
                            }))}
                            filterOption={(input, option) =>
                                (option?.label as string)
                                    ?.toLowerCase()
                                    .includes(input.toLowerCase()) ?? false
                            }
                        />
                    </div>

                    {loadingDeal && (
                        <div className="flex justify-center py-8">
                            <Spin
                                tip={t("pages.meetings.schedule.loading_deal")}
                            />
                        </div>
                    )}

                    {selectedDeal && !loadingDeal && (
                        <SaveFollowup
                            key={formKey}
                            context="deal"
                            deal={selectedDeal}
                            onSubmit={onSubmit}
                            onCancel={handleCancel}
                            loading={isLoading({ status })}
                            errors={errors}
                        />
                    )}

                    {!selectedDealId && !loadingDeal && (
                        <div className="text-center py-8 text-gray-400">
                            <CalendarOutlined className="text-4xl mb-3 block" />
                            <p className="text-sm">
                                {t("pages.meetings.schedule.select_deal_prompt")}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </Drawer>
    );
}
