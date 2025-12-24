import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { DeleteOutlined } from "@ant-design/icons";
import { isLoading, pluralOrSingular } from "@/lib/utils";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";

interface Props extends IModalProps {
    ids: number[];
}

const BulkDeleteFollowups: React.FC<Props> = ({ open, onClose, ids }) => {
    const handleCancel = () => {
        onClose();
    };

    const { mutate, status } = useApiMutate<
        { row_ids: string; action_type: string },
        null,
        ApiResponse<null>
    >(
        `/account/deals/follow-up-apply-quick-action`,

        "POST"
    );
    const onSubmit = () => {
        mutate(
            {
                row_ids: ids.join(","),
                action_type: "delete",
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
            title="Delete Selected Follow-ups"
            description={`Are you sure you want to delete ${pluralOrSingular(
                ids.length,
                "this follow-up",
                "follow-ups"
            )} ? This action cannot be undone.`}
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText="Yes, Delete All"
            cancelText="Cancel"
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default BulkDeleteFollowups;
