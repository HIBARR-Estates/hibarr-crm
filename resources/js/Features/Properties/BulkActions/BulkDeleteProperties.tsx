import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { message } from "antd";
import { useState } from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { pluralOrSingular } from "@/lib/utils";

interface Props extends IModalProps {
    ids: number[];
}

const BulkDeleteProperties: React.FC<Props> = ({ open, onClose, ids }) => {
    const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
    const handleBulkDelete = () => {
        setBulkDeleteLoading(true);
        router.post(
            route("properties.bulk_action"),
            {
                property_ids: ids,
                action_type: "delete",
            },
            {
                onSuccess: () => {
                    message.success("Properties deleted successfully");

                    onClose(true);
                    // Refresh the properties list
                    router.reload();
                },
                onError: () => {
                    message.error("Failed to delete properties");
                },
                onFinish: () => {
                    setBulkDeleteLoading(false);
                },
            }
        );
    };
    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: handleBulkDelete,
                loading: bulkDeleteLoading,
            }}
            title="Delete Selected Properties"
            description={`Are you sure you want to delete ${pluralOrSingular(
                ids.length,
                "this property",
                "properties"
            )} ? This action cannot be undone.`}
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText="Yes, Delete All"
            cancelText="Cancel"
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default BulkDeleteProperties;
