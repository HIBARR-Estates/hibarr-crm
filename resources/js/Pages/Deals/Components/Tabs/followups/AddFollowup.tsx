import { Deal } from "@/Types/api/deals";
import { Lead } from "@/Types/api/leads";
import { IModalProps } from "@/Types/common";
import { App, Drawer } from "antd";
import { useState, useEffect, useCallback } from "react";
import SaveFollowup, { SaveFollowupFormData } from "./SaveFollowup";
import MeetingSuccessStep from "./MeetingSuccessStep";
import { useApiMutate } from "@/lib/api/client";
import { isLoading } from "@/lib/utils";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { router } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";

export type MeetingDrawerContext = "lead" | "deal";

interface Props extends IModalProps {
    context: MeetingDrawerContext;
    deal?: Deal;
    lead?: Lead;
    dealsForLead?: { id: number; name: string }[];
}

const AddFollowup: React.FC<Props> = ({
    context,
    deal,
    lead,
    dealsForLead = [],
    onClose,
    open,
}) => {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const [errors, setErrors] = useState<string[]>([]);
    const [formKey, setFormKey] = useState(0);
    const [step, setStep] = useState<"form" | "success">("form");
    const [blankForm, setBlankForm] = useState(false);

    useEffect(() => {
        if (open) {
            setStep("form");
            setBlankForm(false);
            setErrors([]);
            setFormKey((prev) => prev + 1);
        }
    }, [open]);

    const handleCancel = () => {
        setErrors([]);
        setStep("form");
        setBlankForm(false);
        onClose();
    };

    const handleDone = () => {
        handleCancel();
        router.reload();
    };

    const handleBookAnother = () => {
        setStep("form");
        setBlankForm(true);
        setErrors([]);
        setFormKey((prev) => prev + 1);
    };

    const { mutate, status } = useApiMutate<
        SaveFollowupFormData,
        null,
        ApiResponse<null>
    >(`/account/deals/follow-up-store`, "POST");

    const onSubmit = useCallback(
        (data: SaveFollowupFormData) => {
            if (context === "deal" && deal) {
                const hasAgent =
                    deal.agent_id != null ||
                    (deal.lead_agent != null && deal.lead_agent.id != null);
                if (!hasAgent) {
                    message.warning(
                        "This deal has no agent assigned. Please assign an agent to the deal before booking a meeting.",
                    );
                    return;
                }
            }

            mutate(data, {
                onSuccess: () => {
                    setErrors([]);
                    setStep("success");
                },
                onError: (errorResponse) => {
                    const responseErrors =
                        errorFormatter(errorResponse)?.errors || [];
                    setErrors(Object.values(responseErrors).flat() as string[]);
                },
            });
        },
        [context, deal, message, mutate],
    );

    const canShowForm =
        (context === "deal" && deal) || (context === "lead" && lead);

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
            ) : canShowForm ? (
                <SaveFollowup
                    key={formKey}
                    context={context}
                    deal={context === "deal" ? deal : undefined}
                    lead={context === "lead" ? lead : undefined}
                    dealsForLead={context === "lead" ? dealsForLead : undefined}
                    showLeadEntity={context === "lead" && !blankForm}
                    showOptionalDealSelect={context === "lead" && !blankForm}
                    onSubmit={onSubmit}
                    onCancel={handleCancel}
                    loading={isLoading({ status })}
                    errors={errors}
                />
            ) : null}
        </Drawer>
    );
};

export default AddFollowup;
