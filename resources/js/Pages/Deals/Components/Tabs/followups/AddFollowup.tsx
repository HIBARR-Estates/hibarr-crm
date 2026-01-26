import { Deal } from "@/Types/api/deals";
import { IModalProps } from "@/Types/common";
import { Drawer } from "antd";
import { useState, useEffect } from "react";
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
    timezone?: string; 
}

interface Props extends IModalProps {
    deal: Deal;
}

const AddFollowup: React.FC<Props> = ({ deal, onClose, open }) => {
    const [errors, setErrors] = useState<string[]>([]);
    const [formKey, setFormKey] = useState(0);

    // Reset form when modal opens
    useEffect(() => {
        if (open) {
            setFormKey(prev => prev + 1);
        }
    }, [open]);

    const handleCancel = () => {
        setErrors([]);
        setFormKey(prev => prev + 1); // Force form reset on close
        onClose();
    };

    const { mutate, status } = useApiMutate<
        SaveFollowupFormData,
        null,
        ApiResponse<null>
    >(`/account/deals/follow-up-store`, "POST", () => {
        handleCancel();
    });

    const onSubmit = (data: SaveFollowupFormData) => {
        mutate(data, {
            onSuccess: () => {
                setErrors([]);
                setFormKey(prev => prev + 1); // Reset form after successful submission
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
                key={formKey}
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
