import { Button, Select } from "antd";
import BulkChangeTaskStatus from "./BulkChangeTaskStatus";
import BulkDeleteTasks from "./BulkDeleteTasks";
import React from "react";
import { router } from "@inertiajs/react";

interface TaskboardColumn {
    id: number;
    column_name: string;
    slug: string;
    label_color: string;
    priority: number;
}

interface Task {
    id: number;
    heading: string;
    description?: string;
    due_date?: string;
    start_date?: string;
    priority: "low" | "medium" | "high";
    status: string;
    board_column_id?: number;
}

type TTaskBulkAction = "delete" | "change-status";

interface Props {
    selectedEntityIds?: number[];
    actions?: {
        label: string;
        value: TTaskBulkAction;
    }[];
    clearSelected: () => void;
    columns: TaskboardColumn[];
}

const DEFAULT_TASK_BULK_ACTIONS: Props["actions"] = [
    { label: "Delete", value: "delete" },
    { label: "Change Status", value: "change-status" },
];

const BulkTaskActionSelector: React.FC<Props> = ({
    selectedEntityIds = [],
    actions = DEFAULT_TASK_BULK_ACTIONS,
    clearSelected,
    columns,
}) => {
    const [action, setAction] = React.useState<TTaskBulkAction>();
    const [open, setOpen] = React.useState(false);

    const onApply = () => {
        setOpen(true);
    };

    const onClose = (operationSucceeded?: boolean) => {
        setOpen(false);
        setAction(undefined);
        router.reload();
        if (operationSucceeded) {
            clearSelected();
        }
    };

    return (
        <>
            {/* Bulk Delete Modal */}
            <BulkDeleteTasks
                ids={selectedEntityIds}
                onClose={onClose}
                open={open && action === "delete"}
            />

            {/* Bulk Change Status Modal */}
            <BulkChangeTaskStatus
                ids={selectedEntityIds}
                columns={columns}
                onClose={onClose}
                open={open && action === "change-status"}
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

export default BulkTaskActionSelector;
