import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import { Agent } from "@/Types/api/agents";
import { router } from "@inertiajs/react";
import { message } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";

interface Props extends IModalProps {
    agent?: Agent;
}

const DeleteAgent: React.FC<Props> = ({ open, onClose, agent }) => {
    const { mutate: deleteAgent, status } = useApiMutate<
        {},
        any,
        ApiResponse<any>
    >(agent ? route("agents.destroy", agent.id) : "", "DELETE");

    const handleDelete = () => {
        deleteAgent(
            {},
            {
                onSuccess: () => {
                    message.success("Agent deleted successfully");
                    onClose(true);
                    router.visit(route("agents.index"));
                },
                onError: () => {
                    message.error("Failed to delete agent");
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
                fn: handleDelete,
                loading: loading,
            }}
            title="Delete Agent"
            description={`Are you sure you want to delete ${agent?.user?.name ?? "this agent"}? This will remove all associated agent records. This action cannot be undone.`}
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText="Yes, Delete"
            cancelText="Cancel"
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default DeleteAgent;
