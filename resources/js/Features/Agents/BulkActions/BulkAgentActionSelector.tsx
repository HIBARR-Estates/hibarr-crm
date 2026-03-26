import { Button, Select } from "antd";
import React from "react";
import { Role } from "@/Types";
import BulkChangeAgentRole from "./BulkChangeAgentRole";
import BulkChangeAgentStatus from "./BulkChangeAgentStatus";
import BulkDeleteAgents from "./BulkDeleteAgents";

type TAgentBulkAction = "delete" | "enable" | "disable" | "change_role";

interface Props {
    selectedEntityIds?: number[];
    actions?: {
        label: string;
        value: TAgentBulkAction;
    }[];
    clearSelected: () => void;
    roles?: Role[];
}

const DEFAULT_AGENT_BULK_ACTIONS: Props["actions"] = [
    { label: "Enable", value: "enable" },
    { label: "Disable", value: "disable" },
    { label: "Change Role", value: "change_role" },
    { label: "Delete", value: "delete" },
];

const BulkAgentActionSelector: React.FC<Props> = ({
    selectedEntityIds = [],
    actions = DEFAULT_AGENT_BULK_ACTIONS,
    clearSelected,
    roles = [],
}) => {
    const [action, setAction] = React.useState<TAgentBulkAction>();
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
            <BulkDeleteAgents
                ids={selectedEntityIds}
                onClose={onClose}
                open={open && action === "delete"}
            />

            <BulkChangeAgentStatus
                ids={selectedEntityIds}
                onClose={onClose}
                open={open && (action === "enable" || action === "disable")}
                statusAction={action === "disable" ? "disable" : "enable"}
            />

            <BulkChangeAgentRole
                ids={selectedEntityIds}
                onClose={onClose}
                open={open && action === "change_role"}
                roles={roles}
            />

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

export default BulkAgentActionSelector;
