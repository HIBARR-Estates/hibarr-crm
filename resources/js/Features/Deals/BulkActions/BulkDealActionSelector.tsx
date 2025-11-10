import { Button, Select } from "antd";
import React from "react";
import BulkDeleteDeals from "./BulkDeleteDeals";
import BulkChangeStageForDeals from "./BulkChangeStageForDeals";
import BulkChangeDealAgents from "./BulkChangeDealAgents";
import { PipelineStage } from "@/Types/api/deals";
import { User } from "@/Types";

interface LeadAgent {
    id: number;
    user_id?: number;
    name: string;
    image?: string;
    user?: Pick<User, "id" | "name" | "email" | "image_url">;
}

type TDealBulkAction = "delete" | "change-status" | "change-deal-agents";

interface Props {
    selectedEntityIds?: number[];
    actions?: {
        label: string;
        value: TDealBulkAction;
    }[];
    clearSelected: () => void;
    stages: PipelineStage[];
    leadAgents: LeadAgent[];
}

const DEFAULT_DEAL_BULK_ACTIONS: Props["actions"] = [
    { label: "Delete", value: "delete" },
    { label: "Change Stage", value: "change-status" },
    { label: "Change Agent", value: "change-deal-agents" },
];

const BulkDealActionSelector: React.FC<Props> = ({
    selectedEntityIds = [],
    actions = DEFAULT_DEAL_BULK_ACTIONS,
    clearSelected,
    stages,
    leadAgents,
}) => {
    const [action, setAction] = React.useState<TDealBulkAction>();
    const [open, setOpen] = React.useState(false);

    const onApply = () => {
        setOpen(true);
    };

    const onClose = (operationSucceeded?: boolean) => {
        setOpen(false);
        setAction(undefined);
        if (operationSucceeded) clearSelected();
    };

    return (
        <>
            {/* Bulk Delete Modal */}
            <BulkDeleteDeals
                ids={selectedEntityIds}
                onClose={onClose}
                open={open && action === "delete"}
            />

            {/* Bulk Change Stage Modal */}
            <BulkChangeStageForDeals
                ids={selectedEntityIds}
                stages={stages}
                onClose={onClose}
                open={open && action === "change-status"}
            />

            {/* Bulk Change Agent Modal */}
            <BulkChangeDealAgents
                ids={selectedEntityIds}
                leadAgents={leadAgents}
                onClose={onClose}
                open={open && action === "change-deal-agents"}
            />

            {/* Action Selector UI */}
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                <span className="text-sm text-blue-700">
                    {selectedEntityIds.length} selected
                </span>
                <Select
                    placeholder="Choose action"
                    value={action}
                    onChange={setAction}
                    style={{ width: 180 }}
                    size="small"
                    options={actions}
                />
                <Button
                    type="primary"
                    size="small"
                    disabled={!action}
                    onClick={onApply}
                >
                    Apply
                </Button>
            </div>
        </>
    );
};

export default BulkDealActionSelector;
