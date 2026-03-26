import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { message } from "antd";
import { CheckCircleOutlined, StopOutlined } from "@ant-design/icons";
import { pluralOrSingular, isLoading as getLoadingStatus } from "@/lib/utils";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";

interface Props extends IModalProps {
    ids: number[];
    statusAction: "enable" | "disable";
}

const BulkChangeAgentStatus: React.FC<Props> = ({
    open,
    onClose,
    ids,
    statusAction,
}) => {
    const { mutate: bulkUpdate, status } = useApiMutate<
        { row_ids: string; action_type: string },
        any,
        ApiResponse<any>
    >(route("agents.apply_quick_action"), "POST");

    const handleBulkUpdate = () => {
        bulkUpdate(
            {
                row_ids: ids.join(","),
                action_type: statusAction,
            },
            {
                onSuccess: () => {
                    message.success(
                        `Agents ${statusAction === "enable" ? "enabled" : "disabled"} successfully`,
                    );
                    onClose(true);
                    router.reload();
                },
                onError: () => {
                    message.error("Failed to update agent status");
                },
            },
        );
    };

    const loading = getLoadingStatus({ status });
    const isEnable = statusAction === "enable";

    return (
        <ConfirmationModal
            open={open}
            onClose={() => onClose()}
            onSubmit={{
                fn: handleBulkUpdate,
                loading: loading,
            }}
            title={
                isEnable ? "Enable Selected Agents" : "Disable Selected Agents"
            }
            description={`Are you sure you want to ${statusAction} ${pluralOrSingular(
                ids.length,
                "this agent",
                "agents",
            )}?`}
            icon={
                isEnable ? (
                    <CheckCircleOutlined className="text-green-500 text-3xl" />
                ) : (
                    <StopOutlined className="text-orange-500 text-3xl" />
                )
            }
            confirmText={isEnable ? "Yes, Enable All" : "Yes, Disable All"}
            cancelText="Cancel"
            confirmType="primary"
        />
    );
};

export default BulkChangeAgentStatus;
