import { Button, Select } from "antd";
import React from "react";
import BulkDeleteLeads from "./BulkDeleteLeads";
import BulkChangeCategory from "./BulkChangeCategory";

type TLeadBulkAction = "delete" | "change_category";
interface Props {
    selectedEntityIds?: number[];
    actions?: {
        label: string;
        value: TLeadBulkAction;
    }[];
    clearSelected: () => void;
}

const DEFAULT_LEAD_BULK_ACTIONS: Props["actions"] = [
    { label: "Change Category", value: "change_category" },
    { label: "Delete", value: "delete" },
];

const BulkLeadActionSelector: React.FC<Props> = ({
    selectedEntityIds = [],
    actions = DEFAULT_LEAD_BULK_ACTIONS,
    clearSelected,
}) => {
    const [action, setAction] = React.useState<TLeadBulkAction>();
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
            <BulkDeleteLeads
                ids={selectedEntityIds}
                onClose={onClose}
                open={open && action === "delete"}
            />

            <BulkChangeCategory
                ids={selectedEntityIds}
                onClose={onClose}
                open={open && action === "change_category"}
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

export default BulkLeadActionSelector;
