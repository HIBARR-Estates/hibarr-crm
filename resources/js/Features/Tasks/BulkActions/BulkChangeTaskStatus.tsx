import { IModalProps } from "@/Types/common";
import { Select, Modal, Button } from "antd";
import React, { useState } from "react";
import { SwapOutlined } from "@ant-design/icons";
import { pluralOrSingular } from "@/lib/utils";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiResponse, isSuccessResponse } from "@/lib/api/types";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface TaskboardColumn {
    id: number;
    column_name: string;
    slug: string;
    label_color: string;
    priority: number;
}

interface Props extends IModalProps {
    ids: number[];
    columns: TaskboardColumn[];
}

const BulkChangeTaskStatus: React.FC<Props> = ({
    open,
    onClose,
    ids,
    columns,
}) => {
    const { td } = useTd();
    const [selectedColumnId, setSelectedColumnId] = useState<number>();

    const statusChangeMutation = useApiMutate<
        { row_ids: string; action_type: string; status: number },
        any,
        ApiResponse<any>
    >("/account/tasks/apply-quick-action", "POST", (response) => {
        // Parent BulkTaskActionSelector refreshes task lists on success.
        if (response && isSuccessResponse(response)) {
            onClose(true);
        }
    });

    const handleBulkChangeStatus = () => {
        if (!selectedColumnId) {
            return;
        }

        statusChangeMutation.mutate({
            row_ids: ids.join(","),
            action_type: "change-status",
            status: selectedColumnId,
        });
    };

    const handleClose = () => {
        setSelectedColumnId(undefined);
        onClose();
    };

    const selectedColumn = columns.find(
        (column) => column.id === selectedColumnId,
    );

    return (
        <Modal
            title={
                <div className="flex items-center space-x-2">
                    <SwapOutlined className="text-blue-500" />
                    <span>{td("Change Status for Selected Tasks", { source: "en" })}</span>
                </div>
            }
            open={open}
            onCancel={handleClose}
            footer={[
                <Button key="cancel" onClick={handleClose}>
                    {td("Cancel", { source: "en" })}
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    loading={statusChangeMutation.isPending}
                    disabled={!selectedColumnId}
                    onClick={handleBulkChangeStatus}
                >
                    {td("Update Status", { source: "en" })}
                </Button>,
            ]}
        >
            <div className="space-y-4">
                <p>
                    Select a new status for{" "}
                    {pluralOrSingular(ids.length, "this task", "tasks")}:
                </p>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {td("New Status", { source: "en" })}
                    </label>
                    <Select
                        placeholder={td("Select a status", { source: "en" })}
                        value={selectedColumnId}
                        onChange={setSelectedColumnId}
                        className="w-full"
                        options={columns.map((column) => ({
                            label: (
                                <div className="flex items-center space-x-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{
                                            backgroundColor: column.label_color,
                                        }}
                                    />
                                    <span>{column.column_name}</span>
                                </div>
                            ),
                            value: column.id,
                        }))}
                    />
                </div>
                {selectedColumn && (
                    <div className="p-3 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">
                                {td("Moving to:", { source: "en" })}
                            </span>
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{
                                    backgroundColor: selectedColumn.label_color,
                                }}
                            />
                            <strong>{selectedColumn.column_name}</strong>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default BulkChangeTaskStatus;
