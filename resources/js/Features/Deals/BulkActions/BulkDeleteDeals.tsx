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

const BulkDeleteDeals: React.FC<Props> = ({ open, onClose, ids }) => {
    const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

    const handleBulkDelete = () => {
        setBulkDeleteLoading(true);
        router.post(
            route("deals.apply_quick_action"),
            {
                row_ids: ids.join(","),
                action_type: "delete",
            },
            {
                onSuccess: () => {
                    message.success("Deals deleted successfully");
                    onClose(true);
                    // X2: bulk actions render in table view only — refresh deals list
                    router.reload({ only: ["deals"] });
                },
                onError: () => {
                    message.error("Failed to delete deals");
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
            title="Delete Selected Deals"
            description={`Are you sure you want to delete ${pluralOrSingular(
                ids.length,
                "this deal",
                "deals"
            )}? This action cannot be undone.`}
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText="Yes, Delete All"
            cancelText="Cancel"
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default BulkDeleteDeals;
