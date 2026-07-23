import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import React from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { ApiResponse } from "@/lib/api/types";
import { useApiMutate } from "@/lib/api/client";
import { isLoading } from "@/lib/utils";
import { DealFile } from "@/Types/api";

interface Props extends IModalProps {
    file?: DealFile;
    onSuccess?: () => void;
    /** When true, skip the Inertia reload after delete (parent updates local state). */
    skipReload?: boolean;
}

const DeleteFile: React.FC<Props> = ({
    file,
    onClose,
    open,
    onSuccess,
    skipReload,
}) => {
    const handleCancel = () => {
        onClose();
    };

    const deletePath = file?.id
        ? route("deal-files.destroy", file.id)
        : "/api/v1/deal-files/0";

    const { mutate, status } = useApiMutate<null, null, ApiResponse<null>>(
        deletePath,
        "DELETE",
        () => {
            handleCancel();
        }
    );

    const onSubmit = () => {
        if (!file?.id) {
            return;
        }
        mutate(null, {
            onSuccess: () => {
                onSuccess?.();
                if (!skipReload) {
                    router.reload();
                }
            },
        });
    };

    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: onSubmit,
                loading: isLoading({ status }),
            }}
            title="Delete File"
            description={
                file
                    ? `Are you sure you want to delete ${file?.filename}? This action cannot be undone.`
                    : "Are you sure you want to delete this file? This action cannot be undone."
            }
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText="Yes, Delete"
            cancelText="Cancel"
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default DeleteFile;
