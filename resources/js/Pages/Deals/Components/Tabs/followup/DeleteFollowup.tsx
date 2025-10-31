import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { DealFollowup } from "@/Types/api/deal-followup";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { message } from "antd";
import React, { useState } from "react";
import { DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

interface Props extends IModalProps {
    followup?: DealFollowup;
}

const DeleteFollowup: React.FC<Props> = ({ followup, onClose, open }) => {
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Handle single follow-up deletion
    const handleDeleteFollowup = () => {
        if (!followup) return;

        setDeleteLoading(true);
        router.delete(route("deals.follow_up_delete", followup.id), {
            onSuccess: () => {
                message.success("Follow-up deleted successfully");
                onClose();
                setDeleteLoading(false);
                router.reload();
            },
            onError: () => {
                message.error("Failed to delete follow-up");
                setDeleteLoading(false);
            },
        });
    };

    const getFollowupDisplayText = () => {
        if (!followup) return "this follow-up";

        const date = dayjs(followup.next_follow_up_date).format("MMM DD, YYYY");
        const meetingType = followup.meetingType?.name;

        if (meetingType) {
            return `"${meetingType}" scheduled for ${date}`;
        }

        return `follow-up scheduled for ${date}`;
    };

    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: handleDeleteFollowup,
                loading: deleteLoading,
            }}
            title="Delete Follow-up"
            description={
                followup
                    ? `Are you sure you want to delete ${getFollowupDisplayText()}? This action cannot be undone.`
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
