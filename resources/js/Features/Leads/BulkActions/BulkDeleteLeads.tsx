import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { message } from "antd";
import { useState } from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { pluralOrSingular, isLoading as getLoadingStatus } from "@/lib/utils";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";

interface Props extends IModalProps {
    ids: number[];
}

const BulkDeleteLeads: React.FC<Props> = ({ open, onClose, ids }) => {
    const { mutate: bulkDelete, status } = useApiMutate<
        { row_ids: string; action_type: string },
        any,
        ApiResponse<any>
    >(route("lead-contact.apply_quick_action"), "POST");

    const handleBulkDelete = () => {
        bulkDelete(
            {
                row_ids: ids.join(","),
                action_type: "delete",
            },
            {
                onSuccess: () => {
                    message.success("Leads deleted successfully");
                    onClose(true);
                    // X2: Index-only component — refresh just the leads list
                    router.reload({ only: ["leads"] });
                },
                onError: () => {
                    message.error("Failed to delete leads");
                },
            }
        );
    };

    const loading = getLoadingStatus({ status });

    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: handleBulkDelete,
                loading: loading,
            }}
            title="Delete Selected Contacts"
            description={`Are you sure you want to delete ${pluralOrSingular(
                ids.length,
                "this contact",
                "contacts"
            )} ? This action cannot be undone.`}
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText="Yes, Delete All"
            cancelText="Cancel"
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default BulkDeleteLeads;
