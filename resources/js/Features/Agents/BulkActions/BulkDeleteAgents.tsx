import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { message } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { pluralOrSingular, isLoading as getLoadingStatus } from "@/lib/utils";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface Props extends IModalProps {
    ids: number[];
}

const BulkDeleteAgents: React.FC<Props> = ({ open, onClose, ids }) => {
    const { td } = useTd();
    const { mutate: bulkDelete, status } = useApiMutate<
        { row_ids: string; action_type: string },
        any,
        ApiResponse<any>
    >(route("agents.apply_quick_action"), "POST");

    const handleBulkDelete = () => {
        bulkDelete(
            {
                row_ids: ids.join(","),
                action_type: "delete",
            },
            {
                onSuccess: () => {
                    message.success(td("Agents deleted successfully", { source: "en" }));
                    onClose(true);
                    router.reload();
                },
                onError: () => {
                    message.error(td("Failed to delete agents", { source: "en" }));
                },
            },
        );
    };

    const loading = getLoadingStatus({ status });

    return (
        <ConfirmationModal
            open={open}
            onClose={() => onClose()}
            onSubmit={{
                fn: handleBulkDelete,
                loading: loading,
            }}
            title={td("Delete Selected Agents", { source: "en" })}
            description={`Are you sure you want to delete ${pluralOrSingular(
                ids.length,
                "this agent",
                "agents",
            )}? This action cannot be undone.`}
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText={td("Yes, Delete All", { source: "en" })}
            cancelText={td("Cancel", { source: "en" })}
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default BulkDeleteAgents;
