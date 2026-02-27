import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { Property } from "@/Types";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { message } from "antd";
import React, { useState } from "react";
import { DeleteOutlined } from "@ant-design/icons";

interface Props extends IModalProps {
    property?: Property;
    handleSuccessCallback?: () => void;
}

const DeleteProperty: React.FC<Props> = ({
    property,
    onClose,
    open,
    handleSuccessCallback,
}) => {
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Handle single property deletion
    const handleDeleteProperty = () => {
        if (!property) return;

        setDeleteLoading(true);
        router.delete(route("properties.destroy", property.id), {
            onSuccess: () => {
                message.success("Property deleted successfully");
                onClose();
                setDeleteLoading(false);
                if (handleSuccessCallback) {
                    handleSuccessCallback();
                } else {
                    router.reload();
                }
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
                fn: handleDeleteProperty,
                loading: deleteLoading,
            }}
            title="Delete Property"
            description={
                property
                    ? `Are you sure you want to delete "${property?.title}"? This action cannot be undone.`
                    : "Are you sure you want to delete this property? This action cannot be undone."
            }
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText="Yes, Delete"
            cancelText="Cancel"
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default DeleteProperty;
