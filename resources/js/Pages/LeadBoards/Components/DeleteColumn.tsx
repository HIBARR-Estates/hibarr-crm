import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { PipelineStage } from "@/Types/api/deals";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import React from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { ApiResponse } from "@/lib/api/types";
import { useApiMutate } from "@/lib/api/client";
import { isLoading } from "@/lib/utils";

interface Props extends IModalProps {
    stage?: PipelineStage;
}

const DeleteColumn: React.FC<Props> = ({ stage, onClose, open }) => {
    const handleCancel = () => {
        onClose();
    };

    const { mutate, status } = useApiMutate<null, null, ApiResponse<null>>(
        route("lead-stage-setting.destroy", {
            lead_stage_setting: Number(stage?.id),
        }),
        "DELETE",
        () => {
            handleCancel();
        }
    );

    const onSubmit = () => {
        mutate(null, {
            onSuccess: () => {
                console.log("Stage was deleted successfully...");
                router.reload();
            },
        });
    };

    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: onSubmit,
                loading: isLoading({ status }),
            }}
            title="Delete Stage"
            description={
                stage
                    ? `Are you sure you want to delete the stage "${stage?.name}"? This action cannot be undone and will affect all deals in this stage.`
                    : "Are you sure you want to delete this stage? This action cannot be undone and will affect all deals in this stage."
            }
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText="Yes, Delete Stage"
            cancelText="Cancel"
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default DeleteColumn;
