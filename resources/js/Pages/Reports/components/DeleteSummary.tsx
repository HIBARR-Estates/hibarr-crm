import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import React from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";
import { AgentReportSummary } from "@/Types/api";

interface Props extends IModalProps {
    summary?: AgentReportSummary | null;
    handleSuccessCallback?: () => void;
}

const DeleteSummary: React.FC<Props> = ({
    summary,
    onClose,
    open,
    handleSuccessCallback,
}) => {
    const { mutate: deleteSummary, status } = useApiMutate<
        unknown,
        unknown,
        ApiResponse<unknown>
    >(`/account/agent-reports/saved-summaries/${summary?.id}`, "DELETE");

    const loading = getLoadingStatus({ status });

    // Handle single summary deletion
    const handleDeleteSummary = () => {
        if (!summary) return;

        deleteSummary(undefined, {
            onSuccess: () => {
                onClose();
                if (handleSuccessCallback) {
                    handleSuccessCallback();
                } else {
                    router.reload();
                }
            },
        });
    };
    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: handleDeleteSummary,
                loading: loading,
            }}
            title={summary?.title ? summary.title : "Delete Summary"}
            description={
                summary?.title
                    ? `Are you sure you want to delete "${summary.title}"? This action cannot be undone.`
                    : "Are you sure you want to delete this summary? This action cannot be undone."
            }
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText="Yes, Delete"
            cancelText="Cancel"
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default DeleteSummary;
