import React from "react";
import { Modal } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";

interface BranchChangeWarningModalProps {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
}

const BranchChangeWarningModal: React.FC<BranchChangeWarningModalProps> = ({
    open,
    onConfirm,
    onCancel,
    loading = false,
}) => (
    <Modal
        open={open}
        title={
            <span className="flex items-center gap-2">
                <ExclamationCircleOutlined className="text-amber-500" />
                Change qualification branch?
            </span>
        }
        onOk={onConfirm}
        onCancel={onCancel}
        okText="Change branch"
        okButtonProps={{ danger: true, loading }}
        cancelText="Keep current branch"
    >
        <p className="text-gray-600">
            Changing the entry answer will clear all answers on the current
            branch. This cannot be undone.
        </p>
    </Modal>
);

export default BranchChangeWarningModal;
