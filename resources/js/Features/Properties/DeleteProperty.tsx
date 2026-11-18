import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { Property } from "@/Types";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { message } from "antd";
import React, { useState } from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { useTd } from "@/Hooks/useDynamicTranslation";

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
    const { td } = useTd();
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Handle single property deletion
    const handleDeleteProperty = () => {
        if (!property) return;

        setDeleteLoading(true);
        router.delete(route("properties.destroy", property.id), {
            onSuccess: () => {
                message.success(td("Property deleted successfully", { source: "en" }));
                onClose();
                setDeleteLoading(false);
                if (handleSuccessCallback) {
                    handleSuccessCallback();
                } else {
                    router.reload();
                }
            },
            onError: () => {
                message.error(td("Failed to delete property", { source: "en" }));
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
            title={td("Delete Property", { source: "en" })}
            description={
                property
                    ? `Are you sure you want to delete "${property?.title}"? This action cannot be undone.`
                    : "Are you sure you want to delete this property? This action cannot be undone."
            }
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText={td("Yes, Delete", { source: "en" })}
            cancelText={td("Cancel", { source: "en" })}
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default DeleteProperty;
