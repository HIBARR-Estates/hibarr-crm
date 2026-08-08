import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import React from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiResponse, isSuccessResponse } from "@/lib/api/types";
import { identityTd, type TdFn } from "@/lib/dynamicTranslation";

interface Props extends IModalProps {
    task?: { id: number; heading: string };
    td?: TdFn;
    onDeleted?: (taskId: number) => void;
    /** When true, skip Inertia reload after delete (parent updates local state). */
    skipReload?: boolean;
}

const DeleteTask: React.FC<Props> = ({
    task,
    onClose,
    open,
    td = identityTd,
    onDeleted,
    skipReload = false,
}) => {
    const deleteMutation = useApiMutate<{}, any, ApiResponse<any>>(
        task ? `/account/tasks/${task.id}` : "",
        "DELETE",
    );

    const handleDeleteDeal = () => {
        if (!task) return;
        deleteMutation.mutate(
            {},
            {
                onSuccess: (response) => {
                    if (!isSuccessResponse(response)) return;
                    onDeleted?.(task.id);
                    onClose();
                    if (!skipReload) {
                        router.reload({ only: ["tasks"] });
                    }
                },
            },
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
            title={td("Delete Task", { source: "en" })}
            description={td(task?.heading
                    ? `Are you sure you want to delete "${task?.heading}"? This action cannot be undone.`
                    : "Are you sure you want to delete this task? This action cannot be undone.", { source: "en" })}
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText={td("Yes, Delete", { source: "en" })}
            cancelText={td("Cancel", { source: "en" })}
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default DeleteTask;
