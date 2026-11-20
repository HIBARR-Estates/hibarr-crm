import React from "react";
import { DeleteOutlined } from "@ant-design/icons";
import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import { useDeleteMlmLevel } from "@/Features/Mlm/api";
import type { MlmLevel } from "@/Features/Mlm/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface Props extends IModalProps {
    level?: MlmLevel | null;
    handleSuccessCallback?: () => void;
}

const DeleteLevel: React.FC<Props> = ({
    level,
    onClose,
    open,
    handleSuccessCallback,
}) => {
    const { td } = useTd();
    const { mutate: deleteLevel, status } = useDeleteMlmLevel(
        level?.id ?? 0,
        () => {
            onClose();
            handleSuccessCallback?.();
        },
    );

    const loading = getLoadingStatus({ status });

    const handleDelete = () => {
        if (!level) return;
        deleteLevel({} as any);
    };

    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: handleDelete,
                loading,
            }}
            title={td("Delete Level", { source: "en" })}
            description={
                level
                    ? `Are you sure you want to delete "${level.name}"? This will also remove associated criteria. This action cannot be undone.`
                    : "Are you sure you want to delete this level? This action cannot be undone."
            }
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText={td("Yes, Delete", { source: "en" })}
            cancelText={td("Cancel", { source: "en" })}
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default DeleteLevel;
