import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import React from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { pluralOrSingular } from "@/lib/utils";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiResponse } from "@/lib/api/types";

interface Props extends IModalProps {
    ids: number[];
}

const BulkDeleteTasks: React.FC<Props> = ({ open, onClose, ids }) => {
    const deleteMutation = useApiMutate<
        { row_ids: string; action_type: string },
        any,
        ApiResponse<any>
    >("/account/tasks/apply-quick-action", "POST", () => {
        // Parent BulkTaskActionSelector refreshes task lists on success.
        onClose(true);
    });

    const handleBulkDelete = () => {
        deleteMutation.mutate({
            row_ids: ids.join(","),
            action_type: "delete",
        });
    };

    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: handleBulkDelete,
                loading: deleteMutation.isPending,
            }}
            title="Delete Selected Tasks"
            description={`Are you sure you want to delete ${pluralOrSingular(
                ids.length,
                "this task",
                "tasks",
            )}? This action cannot be undone.`}
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText="Yes, Delete All"
            cancelText="Cancel"
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default BulkDeleteTasks;
