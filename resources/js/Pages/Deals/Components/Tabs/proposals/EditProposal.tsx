import React, { useState } from "react";
import { Button, Tooltip } from "antd";
import { EditOutlined } from "@ant-design/icons";
import SaveProposal from "./SaveProposal";
import { Deal } from "@/Types/api/deals";
import { Proposal } from "@/Types/api/proposal";

interface EditProposalProps {
    deal: Deal;
    proposal: Proposal;
    permissions: Record<string, string>;
    user?: any;
    onSuccess?: () => void;
    trigger?: "button" | "menu-item" | "custom";
    children?: React.ReactNode;
}

export default function EditProposal({
    deal,
    proposal,
    permissions,
    user,
    onSuccess,
    trigger = "button",
    children,
}: EditProposalProps) {
    const [visible, setVisible] = useState(false);

    const canEditProposal =
        !proposal.signature &&
        (permissions.edit_lead_proposals === "all" ||
            (permissions.edit_lead_proposals === "added" &&
                proposal.added_by === user?.id));

    const handleOpenModal = () => {
        if (canEditProposal) {
            setVisible(true);
        }
    };

    const handleCloseModal = () => {
        setVisible(false);
    };

    const handleSuccess = () => {
        setVisible(false);
        onSuccess?.();
    };

    if (!canEditProposal) {
        return null;
    }

    let triggerElement;

    switch (trigger) {
        case "menu-item":
            triggerElement = (
                <span onClick={handleOpenModal} style={{ cursor: "pointer" }}>
                    <EditOutlined className="mr-2" />
                    Edit
                </span>
            );
            break;
        case "custom":
            triggerElement = children ? (
                <div onClick={handleOpenModal} style={{ cursor: "pointer" }}>
                    {children}
                </div>
            ) : null;
            break;
        default:
            triggerElement = (
                <Tooltip title="Edit Proposal">
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={handleOpenModal}
                        size="small"
                    />
                </Tooltip>
            );
    }

    return (
        <>
            {triggerElement}
            <SaveProposal
                visible={visible}
                onClose={handleCloseModal}
                deal={deal}
                proposal={proposal}
                mode="edit"
                onSuccess={handleSuccess}
            />
        </>
    );
}
