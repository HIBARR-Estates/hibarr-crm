import React, { useState, useCallback } from "react";
import {
    Card,
    Avatar,
    Tag,
    Button,
    Input,
    InputNumber,
    Select,
    Space,
    Tooltip,
    message,
    Modal,
    Form,
    Progress,
    Empty,
} from "antd";
import {
    DollarOutlined,
    EditOutlined,
    EyeOutlined,
    UserOutlined,
    CalendarOutlined,
    TrophyOutlined,
    DragOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult,
} from "@hello-pangea/dnd";
import dayjs from "dayjs";
import { router } from "@inertiajs/react";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import SaveDealModal from "@/Features/Deals/SaveDeal/SaveDealModal";
import { Deal } from "@/Types";

interface PipelineStage {
    id: number;
    name: string;
    label_color: string;
    priority: number;
    deals_count?: number;
    total_value?: number;
}

interface DealsTrackerProps {
    deals: Deal[];
    stages: PipelineStage[];
    onStageChange?: (dealId: number, newStageId: number) => Promise<void>;
    onDealUpdate?: (dealId: number, updates: Partial<Deal>) => Promise<void>;
    loading?: boolean;
    canEdit?: boolean;
}

interface QuickEditFormData {
    value: number;
    probability: number;
    close_date: string;
    next_action: string;
}

const DealsTracker: React.FC<DealsTrackerProps> = ({
    deals = [],
    stages = [],
    onStageChange,
    onDealUpdate,
    loading = false,
    canEdit = true,
}) => {
    const [quickEditDeal, setQuickEditDeal] = useState<Deal | null>(null);
    const [form] = Form.useForm<QuickEditFormData>();
    const [processingDeals, setProcessingDeals] = useState<Set<number>>(
        new Set()
    );

    // Organize deals by stage
    const dealsByStage = stages.reduce((acc, stage) => {
        acc[stage.id] = deals.filter(
            (deal) => deal.pipeline_stage_id === stage.id
        );
        return acc;
    }, {} as Record<number, Deal[]>);

    const handleDragEnd = useCallback(
        async (result: DropResult) => {
            if (!result.destination || !onStageChange || !canEdit) return;

            const { source, destination, draggableId } = result;

            // If dropped in the same position, do nothing
            if (
                source.droppableId === destination.droppableId &&
                source.index === destination.index
            ) {
                return;
            }

            const dealId = parseInt(draggableId);
            const newStageId = parseInt(destination.droppableId);

            setProcessingDeals((prev) => new Set(prev).add(dealId));

            try {
                await onStageChange(dealId, newStageId);
                const deal = deals.find((d) => d.id === dealId);
                const newStage = stages.find((s) => s.id === newStageId);
                message.success(`${deal?.name} moved to ${newStage?.name}`);
            } catch (error) {
                message.error("Failed to update deal stage");
            } finally {
                setProcessingDeals((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(dealId);
                    return newSet;
                });
            }
        },
        [deals, stages, onStageChange, canEdit]
    );

    const handleQuickEdit = useCallback(
        async (values: QuickEditFormData) => {
            if (!quickEditDeal || !onDealUpdate) return;

            setProcessingDeals((prev) => new Set(prev).add(quickEditDeal.id));

            try {
                await onDealUpdate(quickEditDeal.id, {
                    value: values.value,
                    probability: values.probability,
                    close_date: values.close_date,
                    // Note: next_action might need to be handled differently based on your API
                });
                message.success("Deal updated successfully");
                setQuickEditDeal(null);
                form.resetFields();
            } catch (error) {
                message.error("Failed to update deal");
            } finally {
                setProcessingDeals((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(quickEditDeal.id);
                    return newSet;
                });
            }
        },
        [quickEditDeal, onDealUpdate, form]
    );

    const openQuickEdit = (deal: Deal) => {
        setQuickEditDeal(deal);
        form.setFieldsValue({
            value: deal.value,
            probability: deal.probability || 50,
            close_date: deal.close_date || undefined,
            next_action: "", // This would need to be fetched from deal data
        });
    };

    const formatCurrency = (
        value: number,
        currency?: { currency_symbol: string }
    ) => {
        const symbol = currency?.currency_symbol || "$";
        return `${symbol}${value.toLocaleString()}`;
    };

    const renderDeal = (deal: Deal, index: number) => {
        const isProcessing = processingDeals.has(deal.id);
        const isOverdue =
            deal.close_date && dayjs(deal.close_date).isBefore(dayjs(), "day");
        const isDueSoon =
            deal.close_date &&
            dayjs(deal.close_date).diff(dayjs(), "days") <= 7;

        return (
            <Draggable
                key={deal.id}
                draggableId={deal.id.toString()}
                index={index}
                isDragDisabled={!canEdit || isProcessing}
            >
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="mb-3"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            whileHover={{ scale: 1.02 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Card
                                size="small"
                                loading={isProcessing}
                                className={`transition-all duration-200 cursor-pointer ${
                                    snapshot.isDragging
                                        ? "shadow-lg rotate-2 z-50"
                                        : "hover:shadow-md"
                                } ${
                                    isOverdue
                                        ? "border-red-300 bg-red-50"
                                        : isDueSoon
                                        ? "border-amber-300 bg-amber-50"
                                        : "border-gray-200 hover:border-blue-300"
                                }`}
                                bodyStyle={{ padding: "12px" }}
                                extra={
                                    canEdit && (
                                        <div
                                            {...provided.dragHandleProps}
                                            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                                        >
                                            <DragOutlined />
                                        </div>
                                    )
                                }
                            >
                                <div className="space-y-2">
                                    {/* Deal Name and Value */}
                                    <div className="flex items-start justify-between">
                                        <Tooltip title={deal.name}>
                                            <div className="font-medium text-gray-900 text-sm truncate flex-1 mr-2">
                                                {deal.name}
                                            </div>
                                        </Tooltip>
                                        <div className="text-lg font-bold text-green-600 shrink-0">
                                            {formatCurrency(
                                                deal.value,
                                                deal.currency
                                            )}
                                        </div>
                                    </div>

                                    {/* Contact Information */}
                                    {deal.contact && (
                                        <div className="flex items-center space-x-2 text-xs text-gray-600">
                                            <UserOutlined />
                                            <span className="truncate">
                                                {deal.contact.client_name}
                                            </span>
                                        </div>
                                    )}

                                    {/* Close Date and Probability */}
                                    <div className="flex items-center justify-between text-xs">
                                        {deal.close_date && (
                                            <div
                                                className={`flex items-center space-x-1 ${
                                                    isOverdue
                                                        ? "text-red-600"
                                                        : isDueSoon
                                                        ? "text-amber-600"
                                                        : "text-gray-600"
                                                }`}
                                            >
                                                <CalendarOutlined />
                                                <span>
                                                    {dayjs(
                                                        deal.close_date
                                                    ).format("MMM DD")}
                                                </span>
                                                {isOverdue && (
                                                    <Tag color="error">
                                                        Overdue
                                                    </Tag>
                                                )}
                                                {isDueSoon && !isOverdue && (
                                                    <Tag color="warning">
                                                        Due Soon
                                                    </Tag>
                                                )}
                                            </div>
                                        )}

                                        {deal.probability && (
                                            <div className="flex items-center space-x-1 text-gray-600">
                                                <TrophyOutlined />
                                                <span>{deal.probability}%</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Agent */}
                                    {deal.agent && (
                                        <div className="flex items-center space-x-2">
                                            <Avatar
                                                size="small"
                                                src={deal.agent.image}
                                                icon={<UserOutlined />}
                                            >
                                                {!deal.agent.image &&
                                                    deal.agent.name?.charAt(0)}
                                            </Avatar>
                                            <span className="text-xs text-gray-600 truncate">
                                                {deal.agent.name}
                                            </span>
                                        </div>
                                    )}

                                    {/* Progress Bar for Probability */}
                                    {deal.probability && (
                                        <Progress
                                            percent={deal.probability}
                                            size="small"
                                            strokeColor={
                                                deal.probability > 70
                                                    ? "#10b981"
                                                    : deal.probability > 40
                                                    ? "#f59e0b"
                                                    : "#ef4444"
                                            }
                                            trailColor="#e5e7eb"
                                            showInfo={false}
                                        />
                                    )}

                                    {/* Quick Actions */}
                                    <div className="flex items-center justify-between pt-1">
                                        <div className="flex space-x-1">
                                            {canEdit && (
                                                <Button
                                                    size="small"
                                                    type="text"
                                                    icon={<EditOutlined />}
                                                    onClick={() => {
                                                        handleAction(
                                                            "edit",
                                                            deal
                                                        );
                                                    }}
                                                    className="text-xs"
                                                >
                                                    Quick Edit
                                                </Button>
                                            )}
                                            <Button
                                                size="small"
                                                type="text"
                                                icon={<EyeOutlined />}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.visit(
                                                        route(
                                                            "deals.show",
                                                            deal.id
                                                        )
                                                    );
                                                }}
                                                className="text-xs"
                                            >
                                                View
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    </div>
                )}
            </Draggable>
        );
    };

    const renderStage = (stage: PipelineStage) => {
        const stageDeals = dealsByStage[stage.id] || [];
        const stageTotalValue = stageDeals.reduce(
            (sum, deal) => sum + deal.value,
            0
        );

        return (
            <div key={stage.id} className="flex-1 min-w-80">
                <Card
                    title={
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{
                                        backgroundColor: stage.label_color,
                                    }}
                                />
                                <span className="font-medium">
                                    {stage.name}
                                </span>
                            </div>
                            <div className="flex items-center space-x-2 text-sm font-normal">
                                <Tag color="blue">{stageDeals.length}</Tag>
                                <span className="text-green-600 font-medium">
                                    ${stageTotalValue.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    }
                    size="small"
                    className="h-full"
                    bodyStyle={{ padding: "8px" }}
                    extra={
                        canEdit && (
                            <Button
                                size="small"
                                type="text"
                                icon={<PlusOutlined />}
                                onClick={() =>
                                    router.visit(
                                        route("deals.create", {
                                            stage: stage.id,
                                        })
                                    )
                                }
                            >
                                Add
                            </Button>
                        )
                    }
                >
                    <Droppable droppableId={stage.id.toString()}>
                        {(provided, snapshot) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`min-h-96 max-h-96 overflow-y-auto transition-colors duration-200 ${
                                    snapshot.isDraggingOver
                                        ? "bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg"
                                        : ""
                                }`}
                                style={{ padding: "4px" }}
                            >
                                <AnimatePresence>
                                    {stageDeals.map((deal, index) =>
                                        renderDeal(deal, index)
                                    )}
                                </AnimatePresence>

                                {stageDeals.length === 0 && (
                                    <div className="flex items-center justify-center h-48 text-gray-400">
                                        <Empty
                                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                                            description="No deals in this stage"
                                        />
                                    </div>
                                )}

                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </Card>
            </div>
        );
    };

    const totalDealsValue = deals.reduce((sum, deal) => sum + deal.value, 0);
    const averageDealValue =
        deals.length > 0 ? totalDealsValue / deals.length : 0;

    const {
        action,
        handleAction,
        handleClose,
        selected: deal,
    } = useGenericEntityAction<Deal>();

    return (
        <>
            <SaveDealModal
                onClose={() => handleClose()}
                open={["add", "edit"].includes(action || "")}
                deal={deal}
            />
            <Card
                title={
                    <div className="flex items-center justify-between">
                        <span>Deals Pipeline</span>
                        <Space>
                            <div className="text-sm font-normal">
                                <span className="text-gray-600">
                                    Total Pipeline:{" "}
                                </span>
                                <span className="font-bold text-green-600">
                                    ${totalDealsValue.toLocaleString()}
                                </span>
                            </div>
                            <div className="text-sm font-normal">
                                <span className="text-gray-600">
                                    Avg Deal:{" "}
                                </span>
                                <span className="font-medium">
                                    $
                                    {Math.round(
                                        averageDealValue
                                    ).toLocaleString()}
                                </span>
                            </div>
                        </Space>
                    </div>
                }
                loading={loading}
                className="h-full"
                bodyStyle={{ padding: "16px" }}
            >
                <DragDropContext onDragEnd={handleDragEnd}>
                    <div className="flex space-x-4 overflow-x-auto pb-4">
                        {stages.map(renderStage)}
                    </div>
                </DragDropContext>
            </Card>
        </>
    );
};

export default DealsTracker;
