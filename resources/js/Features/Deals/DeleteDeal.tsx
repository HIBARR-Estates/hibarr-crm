import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { Lead } from "@/Types";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { message } from "antd";
import React, { useState } from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { Deal } from "@/Types/api/deals";

interface Props extends IModalProps {
    deal?: Deal;
}

const DeleteDeal: React.FC<Props> = ({ deal, onClose, open }) => {
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Handle single deal deletion
    const handleDeleteDeal = () => {
        if (!deal) return;

        setDeleteLoading(true);
        router.delete(route("deals.destroy", deal.id), {
            onSuccess: () => {
                message.success("Deal deleted successfully");
                onClose();
                setDeleteLoading(false);
                router.reload();
            },
            onError: () => {
                message.error("Failed to delete deal");
                setDeleteLoading(false);
            },
        });
    };
    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: handleDeleteDeal,
                loading: deleteLoading,
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
