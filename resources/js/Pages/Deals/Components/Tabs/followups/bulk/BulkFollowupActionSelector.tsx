import { Button, Select } from "antd";
import React from "react";
import BulkDeleteFollowups from "./BulkDeleteFollowups";
import BulkChangeStatusFollowups from "./BulkChangeStatusFollowups";

type TFollowupBulkAction = "delete" | "mark_completed" | "mark_cancelled";

interface Props {
    selectedEntityIds?: number[];
    actions?: {
        label: string;
        value: TFollowupBulkAction;
    }[];
    clearSelected: () => void;
}

const DEFAULT_BULK_ACTIONS: Props["actions"] = [
    { label: "Delete", value: "delete" },
    { label: "Mark as Completed", value: "mark_completed" },
    { label: "Mark as Cancelled", value: "mark_cancelled" },
];

const BulkFollowupActionSelector: React.FC<Props> = ({
    selectedEntityIds = [],
    actions = DEFAULT_BULK_ACTIONS,
    clearSelected,
}) => {
    const [action, setAction] = React.useState<TFollowupBulkAction>();
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
            <BulkChangeStatusFollowups
                ids={selectedEntityIds}
                onClose={onClose}
                open={open && action === "mark_cancelled"}
                title="Change Status to Cancelled"
                status="cancelled"
            />
            <BulkChangeStatusFollowups
                ids={selectedEntityIds}
                onClose={onClose}
                open={open && action === "mark_completed"}
                title="Change Status to Completed"
                status="completed"
            />

            <BulkDeleteFollowups
                ids={selectedEntityIds}
                onClose={onClose}
                open={open && action === "delete"}
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

export default BulkFollowupActionSelector;
