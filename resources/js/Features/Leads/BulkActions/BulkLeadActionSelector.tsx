import { Button, Select } from "antd";
import React from "react";
import BulkDeleteLeads from "./BulkDeleteLeads";
import BulkChangeCategory from "./BulkChangeCategory";
import BulkMergeLeads from "../Merge/BulkMergeLeads";
import useLeadMergeAccess from "../Merge/useLeadMergeAccess";
import { useTd } from "@/Hooks/useDynamicTranslation";

type TLeadBulkAction = "delete" | "change_category" | "merge";
type LeadBulkActionOption = { label: string; value: TLeadBulkAction };
interface Props {
    selectedEntityIds?: number[];
    actions?: LeadBulkActionOption[];
    clearSelected: () => void;
}

const DEFAULT_LEAD_BULK_ACTIONS: LeadBulkActionOption[] = [
    { label: "Change Category", value: "change_category" },
    { label: "Delete", value: "delete" },
];

const BulkLeadActionSelector: React.FC<Props> = ({
    selectedEntityIds = [],
    actions,
    clearSelected,
}) => {
    const { td } = useTd();
    const canMergeLeads = useLeadMergeAccess();
    const resolvedActions =
        actions ??
        (canMergeLeads && selectedEntityIds.length === 2
            ? [
                  ...DEFAULT_LEAD_BULK_ACTIONS,
                  { label: td("Merge"), value: "merge" as const },
              ]
            : DEFAULT_LEAD_BULK_ACTIONS);
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

            <BulkMergeLeads
                ids={selectedEntityIds}
                onClose={onClose}
                open={open && action === "merge"}
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
                    options={resolvedActions}
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
