import { Deal } from "@/Types/api/deals";
import { IModalProps } from "@/Types/common";
import { Drawer } from "antd";
import { useState } from "react";
import SaveFollowup from "./SaveFollowup";
import { useApiMutate } from "@/lib/api/client";
import { isLoading } from "@/lib/utils";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { router } from "@inertiajs/react";

interface SaveFollowupFormData {
    deal_id: number;
    next_follow_up_date: string;
    start_time: string;
    meeting_type_id?: number;
    location: string;
    meeting_link?: string;
    send_reminder?: boolean;
    remind_time?: number;
    remind_type?: string;
    remark?: string;
}

interface Props extends IModalProps {
    deal: Deal;
}

const AddFollowup: React.FC<Props> = ({ deal, onClose, open }) => {
    const [errors, setErrors] = useState<string[]>([]);

    const handleCancel = () => {
        setErrors([]);
        onClose();
    };

    const { mutate, status } = useApiMutate<
        SaveFollowupFormData,
        null,
        ApiResponse<null>
    >(route("deals.follow_up_store"), "POST", () => {
        handleCancel();
    });

    const onSubmit = (data: SaveFollowupFormData) => {
        mutate(data, {
            onSuccess: () => {
                setErrors([]);
                console.log("Follow-up created successfully");
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
        });
    };

    return (
        <Drawer
            title="Schedule Meeting"
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
        >
            <SaveFollowup
                deal={deal}
                onSubmit={onSubmit}
                onCancel={handleCancel}
                loading={isLoading({ status })}
                errors={errors}
            />
        </Drawer>
    );
};

export default AddFollowup;
