import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { SaveFilled } from "@ant-design/icons";
import { isLoading, pluralOrSingular } from "@/lib/utils";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";

interface Props extends IModalProps {
    ids: number[];
    title: string;
    status: string;
}

const BulkChangeStatusFollowups: React.FC<Props> = ({
    open,
    onClose,
    ids,
    title,
    status: proposedStatus,
}) => {
    const handleCancel = () => {
        onClose();
    };

    const { mutate, status } = useApiMutate<
        { row_ids: string; action_type: string; status: string },
        null,
        ApiResponse<null>
    >(
        route("deals.follow_up_apply_quick_action"),

        "POST"
    );
    const onSubmit = () => {
        mutate(
            {
                row_ids: ids.join(","),
                action_type: "change-status",
                status: proposedStatus,
            },
            {
                onSuccess: () => {
                    handleCancel();

                    router.reload();
                },
            }
        );
    };

    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: onSubmit,
                loading: isLoading({ status }),
            }}
            title={title}
            description={`Are you sure you want to change the status of ${pluralOrSingular(
                ids.length,
                "this follow-up",
                "follow-ups"
            )} to ${proposedStatus} ?`}
            icon={null}
            confirmText="Yes"
            cancelText="Cancel"
            confirmType="primary"
            confirmDanger={false}
        />
    );
};

export default BulkChangeStatusFollowups;
