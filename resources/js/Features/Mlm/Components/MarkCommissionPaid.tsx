import React from "react";
import { usePage } from "@inertiajs/react";
import { CheckCircleOutlined } from "@ant-design/icons";
import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import { useMarkCommissionPaid } from "@/Features/Mlm/api";
import type { MlmCommission } from "@/Features/Mlm/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";

interface Props extends IModalProps {
    commission?: MlmCommission | null;
    handleSuccessCallback?: () => void;
}

const MarkCommissionPaid: React.FC<Props> = ({
    commission,
    onClose,
    open,
    handleSuccessCallback,
}) => {
    const { default_currency_symbol: currencySymbol = "" } = usePage()
        .props as any;
    const { mutate: markPaid, status } = useMarkCommissionPaid(
        commission?.id ?? 0,
        () => {
            onClose();
            handleSuccessCallback?.();
        },
    );

    const loading = getLoadingStatus({ status });

    const handleConfirm = () => {
        if (!commission) return;
        markPaid({} as any);
    };

    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: handleConfirm,
                loading,
            }}
            title="Mark Commission as Paid"
            description={
                commission
                    ? `Are you sure you want to mark this ${currencySymbol}${Number(commission.amount).toLocaleString()} commission as paid?`
                    : "Are you sure you want to mark this commission as paid?"
            }
            icon={<CheckCircleOutlined className="text-green-500 text-3xl" />}
            confirmText="Yes, Mark Paid"
            cancelText="Cancel"
        />
    );
};

export default MarkCommissionPaid;
