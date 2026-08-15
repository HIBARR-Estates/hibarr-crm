import React from "react";
import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { message } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { pluralOrSingular, isLoading as getLoadingStatus } from "@/lib/utils";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { getCurrentQueryParams } from "@/lib/inertiaQuery";
import type { BulkTarget } from "@/Features/BulkActions/bulkTarget";
import { buildBulkTargetPayload } from "@/Features/BulkActions/bulkTarget";
import { fmt } from "@/Features/Filters/controls";

interface Props extends IModalProps {
    target: BulkTarget;
}

const BulkDeleteLeads: React.FC<Props> = ({ open, onClose, target }) => {
    const { mutate: bulkDelete, status } = useApiMutate<
        Record<string, unknown>,
        any,
        ApiResponse<any>
    >(route("lead-contact.apply_quick_action"), "POST");

    const handleBulkDelete = () => {
        const payload: Record<string, unknown> = {
            ...buildBulkTargetPayload(target),
            ...getCurrentQueryParams(),
            action_type: "delete",
        };
        delete payload.page;
        delete payload.per_page;

        bulkDelete(payload, {
            onSuccess: () => {
                message.success("Leads deleted successfully");
                onClose(true);
                router.reload({ only: ["leads"] });
            },
            onError: () => {
                message.error("Failed to delete leads");
            },
        });
    };

    const loading = getLoadingStatus({ status });
    const count = target.count;

    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: handleBulkDelete,
                loading: loading,
            }}
            title="Delete Selected Contacts"
            description={`Are you sure you want to delete ${
                target.mode === "all_matching"
                    ? `all ${fmt(count)} matching contacts`
                    : pluralOrSingular(count, "this contact", `${fmt(count)} contacts`)
            }? This action cannot be undone.`}
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText="Yes, Delete All"
            cancelText="Cancel"
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default BulkDeleteLeads;
