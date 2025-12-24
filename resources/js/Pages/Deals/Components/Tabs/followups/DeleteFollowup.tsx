import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { DealFollowup } from "@/Types/api/deal-followup";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import React from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { ApiResponse } from "@/lib/api/types";
import { useApiMutate } from "@/lib/api/client";
import { isLoading } from "@/lib/utils";
import dayjs from "dayjs";

interface Props extends IModalProps {
    followup?: DealFollowup;
}

const DeleteFollowup: React.FC<Props> = ({ followup, onClose, open }) => {
    const handleCancel = () => {
        onClose();
    };

    const { mutate, status } = useApiMutate<null, null, ApiResponse<null>>(
        `/account/deals/follow-up-delete/${followup?.id}`,
        "POST",
        () => {
            handleCancel();
        }
    );

    const onSubmit = () => {
        mutate(null, {
            onSuccess: () => {
                console.log("Follow-up deleted successfully");
                router.reload();
            },
        });
    };

    const formatFollowupTitle = (followup: DealFollowup) => {
        if (!followup) return "this follow-up";

        const date = dayjs(followup.next_follow_up_date).format("MMM DD, YYYY");
        const meetingType = followup.meeting_type?.name || "Meeting";
        return `"${meetingType} on ${date}"`;
    };

    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: onSubmit,
                loading: isLoading({ status }),
            }}
            title="Delete Follow-up"
            description={
                followup
                    ? `Are you sure you want to delete ${formatFollowupTitle(
                          followup
                      )}? This action cannot be undone.`
                    : "Are you sure you want to delete this follow-up? This action cannot be undone."
            }
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText="Yes, Delete"
            cancelText="Cancel"
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default DeleteFollowup;
