import { Button, Select } from "antd";
import React from "react";
import BulkDeleteDealNotes from "./BulkDeleteDealNotes";

type TLeadBulkAction = "delete";
interface Props {
    selectedEntityIds?: number[];
    actions?: {
        label: string;
        value: TLeadBulkAction;
    }[];
    clearSelected: () => void;
}

const DEFAULT_BULK_ACTIONS: Props["actions"] = [
    { label: "Delete", value: "delete" },
];

const BulkDealNoteActionSelector: React.FC<Props> = ({
    selectedEntityIds = [],
    actions = DEFAULT_BULK_ACTIONS,
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
            <BulkDeleteDealNotes
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

export default BulkDealNoteActionSelector;
