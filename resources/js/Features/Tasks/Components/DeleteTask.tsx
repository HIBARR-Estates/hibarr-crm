import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import React from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiResponse } from "@/lib/api/types";

interface Props extends IModalProps {
    task?: { id: number; heading: string };
}

const DeleteTask: React.FC<Props> = ({ task, onClose, open }) => {
    const deleteMutation = useApiMutate<{}, any, ApiResponse<any>>(
        task ? `/account/tasks/${task.id}` : "",
        "DELETE"
    );

    // Handle single task deletion
    const handleDeleteDeal = () => {
        if (!task) return;
        deleteMutation.mutate(
            {},
            {
                onSuccess: () => {
                    onClose();
                    // refreshes data on the current page
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
                fn: handleDeleteDeal,
                loading: deleteMutation.isPending,
            }}
            title="Delete Task"
            description={
                task?.heading
                    ? `Are you sure you want to delete "${task?.heading}"? This action cannot be undone.`
                    : "Are you sure you want to delete this task? This action cannot be undone."
            }
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText="Yes, Delete"
            cancelText="Cancel"
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default DeleteTask;
