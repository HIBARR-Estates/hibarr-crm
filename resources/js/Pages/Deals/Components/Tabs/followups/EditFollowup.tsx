import { Deal } from "@/Types/api/deals";
import { DealFollowup } from "@/Types/api/deal-followup";
import { IModalProps } from "@/Types/common";
import { Drawer } from "antd";
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
    deal: Deal;
    followup: DealFollowup;
}

const EditFollowup: React.FC<Props> = ({ deal, followup, onClose, open }) => {
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
        <Drawer
            title="Edit Follow-up"
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
        >
            <SaveFollowup
                context="deal"
                deal={deal}
                followup={followup}
                onSubmit={onSubmit}
                onCancel={handleCancel}
                loading={isLoading({ status })}
                errors={errors}
            />
        </Drawer>
    );
};

export default EditFollowup;
