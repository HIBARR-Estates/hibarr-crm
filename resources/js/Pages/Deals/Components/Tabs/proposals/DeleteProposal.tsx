import React from "react";
import { Modal, Button, Tooltip, message } from "antd";
import { DeleteOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { router } from "@inertiajs/react";
import { Deal } from "@/Types/api/deals";
import { Proposal } from "@/Types/api/proposal";

interface DeleteProposalProps {
    deal: Deal;
    proposal: Proposal;
    permissions: Record<string, string>;
    user?: any;
    onSuccess?: () => void;
    trigger?: "button" | "menu-item" | "custom";
    children?: React.ReactNode;
}

export default function DeleteProposal({
    deal,
    proposal,
    permissions,
    user,
    onSuccess,
    trigger = "button",
    children,
}: DeleteProposalProps) {
    const canDeleteProposal =
        !proposal.signature &&
        (permissions.delete_lead_proposals === "all" ||
            (permissions.delete_lead_proposals === "added" &&
                proposal.added_by === user?.id));

    const handleDeleteConfirm = () => {
        Modal.confirm({
            title: "Delete Proposal",
            icon: <ExclamationCircleOutlined />,
            content: (
                <div>
                    <p>Are you sure you want to delete this proposal?</p>
                    <p>
                        <strong>Proposal:</strong> {proposal.proposal_number}
                    </p>
                    <p>
                        <strong>Total:</strong>{" "}
                        {proposal.currency?.currency_symbol}
                        {proposal.total?.toLocaleString()}
                    </p>
                    <p className="text-red-500 mt-2">
                        <strong>Warning:</strong> This action cannot be undone.
                    </p>
                </div>
            ),
            okText: "Yes, Delete",
            okType: "danger",
            cancelText: "Cancel",
            width: 480,
            onOk() {
                return new Promise((resolve, reject) => {
                    router.delete(route("proposals.destroy", proposal.id), {
                        onSuccess: () => {
                            message.success("Proposal deleted successfully");
                            onSuccess?.();
                            resolve(true);
                        },
                        onError: (errors) => {
                            console.error("Delete proposal error:", errors);
                            message.error("Failed to delete proposal");
                            reject(false);
                        },
                    });
                });
            },
        });
    };

    if (!canDeleteProposal) {
        return null;
    }

    let triggerElement;

    switch (trigger) {
        case "menu-item":
            triggerElement = (
                <span
                    onClick={handleDeleteConfirm}
                    style={{ cursor: "pointer" }}
                    className="text-red-600"
                >
                    <DeleteOutlined className="mr-2" />
                    Delete
                </span>
            );
            break;
        case "custom":
            triggerElement = children ? (
                <div
                    onClick={handleDeleteConfirm}
                    style={{ cursor: "pointer" }}
                >
                    {children}
                </div>
            ) : null;
            break;
        default:
            triggerElement = (
                <Tooltip title="Delete Proposal">
                    <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={handleDeleteConfirm}
                        size="small"
                    />
                </Tooltip>
            );
    }

    return triggerElement;
}
