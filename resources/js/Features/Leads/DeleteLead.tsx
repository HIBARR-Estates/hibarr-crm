import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { Lead } from "@/Types";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import React from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";

interface Props extends IModalProps {
    lead?: Lead;
}

const DeleteLead: React.FC<Props> = ({ lead, onClose, open }) => {
    const { mutate: deleteLead, status } = useApiMutate<
        unknown,
        unknown,
        ApiResponse<unknown>
    >(lead ? route("lead-contact.destroy", lead.id) : "", "DELETE");

    const loading = getLoadingStatus({ status });

    // Handle single deal deletion
    const handleDeleteLead = () => {
        if (!lead) return;

        deleteLead(undefined, {
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
                fn: handleDeleteLead,
                loading: loading,
            }}
            title="Delete Contact"
            description={
                lead
                    ? `Are you sure you want to delete "${lead?.client_name}"? This action cannot be undone.`
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

export default DeleteLead;
