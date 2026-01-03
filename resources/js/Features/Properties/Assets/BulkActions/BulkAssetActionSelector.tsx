import { Button, Select } from "antd";
import React from "react";
import BulkDeleteAssets from "./BulkDeleteAssets";
import BulkApplyTagsToAssets from "./BulkApplyTagsToAssets";

type TAssetBulkAction = "apply-tags" | "delete";

interface Props {
    selectedEntityIds?: number[];
    propertyId: number;
    availableTags: Record<string, string>;
    actions?: {
        label: string;
        value: TAssetBulkAction;
    }[];
    clearSelected: () => void;
}

const DEFAULT_ASSET_BULK_ACTIONS: Props["actions"] = [
    { label: "Apply Tags", value: "apply-tags" },
    { label: "Delete", value: "delete" },
];

const BulkAssetActionSelector: React.FC<Props> = ({
    selectedEntityIds = [],
    propertyId,
    availableTags,
    actions = DEFAULT_ASSET_BULK_ACTIONS,
    clearSelected,
}) => {
    const [action, setAction] = React.useState<TAssetBulkAction>();
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
            <BulkDeleteAssets
                ids={selectedEntityIds}
                propertyId={propertyId}
                onClose={onClose}
                open={open && action === "delete"}
            />
            <BulkApplyTagsToAssets
                ids={selectedEntityIds}
                propertyId={propertyId}
                availableTags={availableTags}
                onClose={onClose}
                open={open && action === "apply-tags"}
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

export default BulkAssetActionSelector;
