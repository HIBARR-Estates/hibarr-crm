import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import React from "react";
import { DeleteOutlined } from "@ant-design/icons";
import type { Offer } from "@/Types/api/offers";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";

interface Props extends IModalProps {
    offer?: Offer;
    handleSuccessCallback?: () => void;
}

const DeleteOffer: React.FC<Props> = ({
    offer,
    onClose,
    open,
    handleSuccessCallback,
}) => {
    const { mutate: deleteOffer, status } = useApiMutate<
        unknown,
        unknown,
        ApiResponse<unknown>
    >(`/account/offers/${offer?.id}`, "DELETE");

    const loading = getLoadingStatus({ status });

    const hasProjects =
        (offer?.developer_projects_count ?? 0) > 0 ||
        (offer?.developer_projects?.length ?? 0) > 0;

    const handleDeleteOffer = () => {
        if (!offer || hasProjects) return;

        deleteOffer(undefined, {
            onSuccess: () => {
                onClose();
                if (handleSuccessCallback) {
                    handleSuccessCallback();
                } else {
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
                fn: handleDeleteOffer,
                loading: loading,
            }}
            title={hasProjects ? "Cannot Delete Offer" : "Delete Offer"}
            description={
                hasProjects
                    ? "This offer is attached to one or more projects and cannot be deleted. Please detach it from all projects first."
                    : offer
                      ? `Are you sure you want to delete "${offer.name}"? This action cannot be undone.`
                      : "Are you sure you want to delete this offer? This action cannot be undone."
            }
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText="Yes, Delete"
            cancelText="Cancel"
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default DeleteOffer;
