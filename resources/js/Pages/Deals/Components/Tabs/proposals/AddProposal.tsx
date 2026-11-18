import React, { useState } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import SaveProposal from "./SaveProposal";
import { Deal } from "@/Types/api/deals";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface AddProposalProps {
    deal: Deal;
    permissions: Record<string, string>;
    onSuccess?: () => void;
    trigger?: "button" | "custom";
    children?: React.ReactNode;
}

export default function AddProposal({
    deal,
    permissions,
    onSuccess,
    trigger = "button",
    children,
}: AddProposalProps) {
    const { td } = useTd();
    const [visible, setVisible] = useState(false);

    const canAddProposal =
        permissions.add_lead_proposals === "all" ||
        permissions.add_lead_proposals === "added";

    const handleOpenModal = () => {
        if (canAddProposal) {
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

    if (!canAddProposal) {
        return null;
    }

    const triggerElement =
        trigger === "custom" && children ? (
            <div onClick={handleOpenModal} style={{ cursor: "pointer" }}>
                {children}
            </div>
        ) : (
            <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenModal}
            >
                {td("Add Proposal", { source: "en" })}
            </Button>
        );

    return (
        <>
            {triggerElement}
            <SaveProposal
                visible={visible}
                onClose={handleCloseModal}
                deal={deal}
                mode="create"
                onSuccess={handleSuccess}
            />
        </>
    );
}
