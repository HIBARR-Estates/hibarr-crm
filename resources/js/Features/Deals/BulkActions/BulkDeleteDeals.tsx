import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { message } from "antd";
import { useState } from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { pluralOrSingular } from "@/lib/utils";
import { getCurrentQueryParams } from "@/lib/inertiaQuery";
import type { BulkTarget } from "@/Features/BulkActions/bulkTarget";
import { buildBulkTargetPayload } from "@/Features/BulkActions/bulkTarget";

interface Props extends IModalProps {
    target: BulkTarget;
}

const BulkDeleteDeals: React.FC<Props> = ({ open, onClose, target }) => {
    const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

    const handleBulkDelete = () => {
        setBulkDeleteLoading(true);

        // "All matching" is resolved server-side from these same filters.
        const payload: Record<string, any> = {
            ...buildBulkTargetPayload(target),
            ...(target.mode === "all_matching" ? getCurrentQueryParams() : {}),
            action_type: "delete",
        };
        delete payload.page;
        delete payload.per_page;

        router.post(route("deals.apply_quick_action"), payload as any, {
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
        });
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
                target.count,
                "this deal",
                "deals",
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
