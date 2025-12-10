import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { Lead } from "@/Types";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import React from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiResponse } from "@/lib/api/types";

interface Props extends IModalProps {
    lead?: Lead;
}

const DeleteLead: React.FC<Props> = ({ lead, onClose, open }) => {
    const deleteMutation = useApiMutate<{}, any, ApiResponse<any>>(
        lead ? `/account/lead-contact/${lead.id}` : "",
        "DELETE",
        () => {
            onClose();
            router.visit(route("lead-contact.index"));
        }
    );

    // Handle single lead deletion
    const handleDeleteLead = () => {
        if (!lead) return;
        deleteMutation.mutate({});
    };
    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: handleDeleteLead,
                loading: deleteMutation.isPending,
            }}
            title="Delete Lead"
            description={
                lead
                    ? `Are you sure you want to delete "${lead?.client_name}"? This action cannot be undone.`
                    : "Are you sure you want to delete this lead? This action cannot be undone."
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
