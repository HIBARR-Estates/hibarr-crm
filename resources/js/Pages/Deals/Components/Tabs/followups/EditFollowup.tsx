import { Deal } from "@/Types/api/deals";
import { Lead } from "@/Types/api/leads";
import { DealFollowup } from "@/Types/api/deal-followup";
import { IModalProps } from "@/Types/common";
import { Modal } from "antd";
import "./followup-modal.css";
import { useState } from "react";
import SaveFollowup from "./SaveFollowup";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import { errorFormatter } from "@/lib/api/utils/common";
import { router } from "@inertiajs/react";

interface SaveFollowupFormData {
    lead_id?: number;
    deal_id?: number;
    next_follow_up_date: string;
    start_time: string;
    meeting_type_id?: number;
    location: string;
    meeting_link?: string;
    send_reminder?: boolean;
    remind_time?: number;
    remind_type?: string;
    remark?: string;
    timezone?: string;
    participants?: number[];
}

interface Props extends IModalProps {
    deal?: Deal;
    lead?: Lead;
    followup: DealFollowup;
}

const EditFollowup: React.FC<Props> = ({ deal, lead, followup, onClose, open }) => {
    const [errors, setErrors] = useState<string[]>([]);

    const handleCancel = () => {
        setErrors([]);
        onClose();
    };

    const { mutate, status } = useApiMutate<
        SaveFollowupFormData & { id: number },
        null,
        ApiResponse<null>
    >(`/account/deals/follow-up-update`, "POST", () => {
        handleCancel();
    });

    const onSubmit = (data: SaveFollowupFormData) => {
        mutate(
            { ...data, id: followup.id },
            {
                onSuccess: () => {
                    setErrors([]);
                    console.log("Follow-up updated successfully");
                    router.reload();
                },
                onError: (errorResponse) => {
                    const responseErrors =
                        errorFormatter(errorResponse)?.errors || [];
                    setErrors((prev) => [
                        ...prev,
                        ...Object.values(responseErrors).flat(),
                    ]);
                },
            },
        );
    };

    return (
        <Modal
            className="followup-modal"
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
            {/* Header */}
            <div className="px-6 pt-6 pb-5 pr-14 border-b border-gray-100 shrink-0">
                <h2 className="text-xl font-semibold text-gray-900 leading-tight">
                    Edit Meeting
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                    Update the meeting details below.
                </p>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
                <SaveFollowup
                    context={deal ? "deal" : "lead"}
                    deal={deal}
                    lead={lead}
                    followup={followup}
                    onSubmit={onSubmit}
                    onCancel={handleCancel}
                    loading={isLoading({ status })}
                    errors={errors}
                />
            </div>
        </Modal>
    );
};

export default EditFollowup;
