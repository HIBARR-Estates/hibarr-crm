import { IModalProps } from "@/Types/common";
import { PipelineStage } from "@/Types/api/deals";
import { router } from "@inertiajs/react";
import { message, Select, Modal, Button } from "antd";
import { useState } from "react";
import { SwapOutlined } from "@ant-design/icons";
import { pluralOrSingular } from "@/lib/utils";

interface Props extends IModalProps {
    ids: number[];
    stages: PipelineStage[];
}

const BulkChangeStageForDeals: React.FC<Props> = ({
    open,
    onClose,
    ids,
    stages: originalStages,
}) => {
    // On the url there is a lead_pipeline_id query param which we can use to filter stages to only those in the current pipeline. If it's not present, show all stages. We have to do this filtering client-side because the bulk action modal is generic and doesn't know about the current pipeline when it fetches the stages list.
    const urlParams = new URLSearchParams(window.location.search);
    const leadPipelineId = urlParams.get("lead_pipeline_id");
    const stages = originalStages.filter(
        (s) => !leadPipelineId || s.lead_pipeline_id === Number(leadPipelineId),
    );
    const [bulkChangeStageLoading, setBulkChangeStageLoading] = useState(false);
    const [selectedStageId, setSelectedStageId] = useState<number>();

    const handleBulkChangeStage = () => {
        if (!selectedStageId) {
            message.error("Please select a stage");
            return;
        }

        setBulkChangeStageLoading(true);
        router.post(
            route("deals.apply_quick_action"),
            {
                row_ids: ids.join(","),
                action_type: "change-status",
                status: selectedStageId,
            },
            {
                onSuccess: () => {
                    message.success("Deal stages updated successfully");
                    onClose(true);
                    // Refresh the deals list
                    router.reload();
                },
                onError: () => {
                    message.error("Failed to update deal stages");
                },
                onFinish: () => {
                    setBulkChangeStageLoading(false);
                },
            },
        );
    };

    const handleClose = () => {
        setSelectedStageId(undefined);
        onClose();
    };

    const selectedStage = stages.find((stage) => stage.id === selectedStageId);

    return (
        <Modal
            title={
                <div className="flex items-center space-x-2">
                    <SwapOutlined className="text-blue-500" />
                    <span>Change Stage for Selected Deals</span>
                </div>
            }
            open={open}
            onCancel={handleClose}
            footer={[
                <Button key="cancel" onClick={handleClose}>
                    Cancel
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    loading={bulkChangeStageLoading}
                    disabled={!selectedStageId}
                    onClick={handleBulkChangeStage}
                >
                    Update Stages
                </Button>,
            ]}
        >
            <div className="space-y-4">
                <p>
                    Select a new stage for{" "}
                    {pluralOrSingular(ids.length, "this deal", "deals")}:
                </p>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Stage
                    </label>
                    <Select
                        placeholder="Select a stage"
                        value={selectedStageId}
                        onChange={setSelectedStageId}
                        className="w-full"
                        options={stages.map((stage) => ({
                            label: stage.name,
                            value: stage.id,
                        }))}
                    />
                </div>
                {selectedStage && (
                    <div className="p-3 bg-gray-50 rounded">
                        <span className="text-sm text-gray-600">
                            Moving to: <strong>{selectedStage.name}</strong>
                        </span>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default BulkChangeStageForDeals;
