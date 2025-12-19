import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import React from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { Deal } from "@/Types/api/deals";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";

interface Props extends IModalProps {
    deal?: Deal;
}

const DeleteDeal: React.FC<Props> = ({ deal, onClose, open }) => {
    const { mutate: deleteDeal, status } = useApiMutate<
        unknown,
        unknown,
        ApiResponse<unknown>
    >(deal ? route("deals.destroy", deal.id) : "", "DELETE");

    const loading = getLoadingStatus({ status });

    // Handle single deal deletion
    const handleDeleteDeal = () => {
        if (!deal) return;

        deleteDeal(undefined, {
            onSuccess: () => {
                onClose();
                router.reload();
            },
        });
    };
    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: handleDeleteDeal,
                loading: loading,
            }}
            title="Delete Deal"
            description={
                deal
                    ? `Are you sure you want to delete "${deal?.name}"? This action cannot be undone.`
                    : "Are you sure you want to delete this deal? This action cannot be undone."
            }
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText="Yes, Delete"
            cancelText="Cancel"
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default DeleteDeal;
