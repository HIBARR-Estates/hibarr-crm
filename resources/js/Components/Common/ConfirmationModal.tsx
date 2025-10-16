import React from "react";
import { Modal, Button, Space, Typography, ButtonProps } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface ConfirmationModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: {
        fn: () => void;
        loading?: boolean;
    };
    title?: string;
    description?: string;
    icon?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    confirmType?: ButtonProps["type"];
    confirmDanger?: boolean;
}

export default function ConfirmationModal({
    open,
    onClose,
    onSubmit,
    title = "Are you sure?",
    description,
    icon = <ExclamationCircleOutlined className="text-yellow-500 text-2xl " />,
    confirmText = "Yes, Continue",
    cancelText = "Cancel",
    confirmType = "primary",
    confirmDanger = false,
}: ConfirmationModalProps) {
    const handleSubmit = () => {
        onSubmit.fn();
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width={400}
            centered
            className="confirmation-modal"
            maskClosable={!onSubmit.loading}
            closable={!onSubmit.loading}
        >
            <div className="text-center py-4">
                {/* Icon */}
                <div className="mb-4 flex justify-center">{icon}</div>

                {/* Title */}
                <div className="mb-3">
                    <Text strong className="text-lg">
                        {title}
                    </Text>
                </div>

                {/* Description */}
                {description && (
                    <div className="mb-6">
                        <Text type="secondary" className="text-sm">
                            {description}
                        </Text>
                    </div>
                )}

                {/* Action Buttons */}
                <Space size="middle">
                    <Button
                        onClick={onClose}
                        disabled={onSubmit.loading}
                        size="middle"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        type={confirmType}
                        onClick={handleSubmit}
                        loading={onSubmit.loading}
                        size="middle"
                        danger={confirmDanger}
                    >
                        {confirmText}
                    </Button>
                </Space>
            </div>
        </Modal>
    );
}
