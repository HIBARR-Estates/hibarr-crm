import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { Lead } from "@/Types";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { message } from "antd";
import React, { useState } from "react";
import { DeleteOutlined } from "@ant-design/icons";

interface Props extends IModalProps {
    lead?: Lead;
}

const DeleteLead: React.FC<Props> = ({ lead, onClose, open }) => {
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Handle single lead deletion
    const handleDeleteLead = () => {
        if (!lead) return;

        setDeleteLoading(true);
        router.delete(route("lead-contact.destroy", lead.id), {
            onSuccess: () => {
                message.success("Lead deleted successfully");
                onClose();
                setDeleteLoading(false);
                router.reload();
            },
            onError: () => {
                message.error("Failed to delete property");
                setDeleteLoading(false);
            },
        });
    };
    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: handleDeleteLead,
                loading: deleteLoading,
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
