import { Button, Select } from "antd";
import React from "react";
import BulkDeleteProperties from "./BulkDeleteProperties";
import BulkAssignPropertiesToProject from "./BulkAssignPropertiesToProject";
import BulkChangeStatusProperties from "./BulkChangeStatusProperties";

type TPropertyBulkAction = "change-status" | "delete" | "assign-to-project";
interface Props {
    selectedEntityIds?: number[];
    actions?: {
        label: string;
        value: TPropertyBulkAction;
    }[];
    clearSelected: () => void;
}

const DEFAULT_PROPERTY_BULK_ACTIONS: Props["actions"] = [
    { label: "Change Status", value: "change-status" },
    { label: "Assign to Project", value: "assign-to-project" },
    { label: "Delete", value: "delete" },
];

const BulkActionSelector: React.FC<Props> = ({
    selectedEntityIds = [],
    actions = DEFAULT_PROPERTY_BULK_ACTIONS,
    clearSelected,
}) => {
    const [action, setAction] = React.useState<TPropertyBulkAction>();
    const [open, setOpen] = React.useState(false);
    const onApply = () => {
        setOpen(true);
    };
    const onClose = () => {
        setOpen(false);
        setAction(undefined);
    };
    return (
        <>
            <BulkDeleteProperties
                ids={selectedEntityIds}
                onClose={onClose}
                open={open && action === "delete"}
            />
            <BulkChangeStatusProperties
                ids={selectedEntityIds}
                onClose={onClose}
                open={open && action === "change-status"}
            />
            <BulkAssignPropertiesToProject
                ids={selectedEntityIds}
                onClose={onClose}
                open={open && action === "assign-to-project"}
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

export default BulkActionSelector;
