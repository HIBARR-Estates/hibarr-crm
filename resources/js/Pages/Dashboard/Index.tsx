import React, { useState, useCallback } from "react";

import { motion } from "framer-motion";
import { Row, Col, message } from "antd";

import OverviewMetricsBar from "@/Features/Dashboard/Components/OverviewMetricsBar";
import TasksActivitiesPanel from "@/Features/Dashboard/Components/TasksActivitiesPanel";
import MeetingsPanel from "@/Features/Dashboard/Components/MeetingsPanel";
import DataQualityPanel from "@/Features/Dashboard/Components/DataQualityPanel";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { router, usePage } from "@inertiajs/react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Activity, CheckCircle, Trophy } from "lucide-react";
import { Deal } from "@/Types";
import useTranslation from "@/Hooks/useTranslation";

dayjs.extend(relativeTime);

interface Task {
    id: number;
    heading: string;
    description?: string;
    due_date?: string;
    start_date?: string;
    priority: "low" | "medium" | "high" | "highest" | "urgent";
    status: string;
    board_column_id?: number;
    project?: {
        id: number;
        project_name: string;
        project_short_code?: string;
    };
    category?: {
        id: number;
        category_name: string;
    };
    users?: Array<{
        id: number;
        name: string;
        image?: string;
    }>;
    labels?: Array<{
        id: number;
        label_name: string;
        label_color: string;
    }>;
    estimate_hours?: number;
    estimate_minutes?: number;
    is_private?: boolean;
    billable?: boolean;
    without_duedate?: boolean;
}

interface PipelineStage {
    id: number;
    name: string;
    label_color: string;
    priority: number;
}

interface DataQualityRecord {
    id: number;
    type: "deal" | "lead";
    name: string;
    data_quality_score: number;
    missing_fields: string[];
    data_issues: Array<{
        field: string;
        issue: string;
        severity: "high" | "medium" | "low";
        suggestion?: string;
    }>;
    contact?: {
        id: number;
        client_name: string;
        client_email?: string;
        mobile?: string;
    };
    value?: number;
    stage?: string;
    agent?: {
        id: number;
        name: string;
        image?: string;
    };
    updated_at: string;
    priority_score: number;
}

interface CommunicationActivity {
    id: number;
    channel_type: string;
    message_content: string;
    timestamp: string;
    sender_info: {
        name: string;
        contact?: string;
    };
    deal?: {
        id: number;
        name: string;
    };
}

interface OverviewMetrics {
    activeLeads: number;
    openDeals: number;
    closedDeals: number;
    quotaProgress: {
        current: number;
        target: number;
    };
    pendingActivities: number;
    conversionRate: number;
    trends?: {
        activeLeads?: { value: number; isPositive: boolean };
        openDeals?: { value: number; isPositive: boolean };
        closedDeals?: { value: number; isPositive: boolean };
        conversionRate?: { value: number; isPositive: boolean };
    };
}

interface DashboardStats {
    total_tasks: number;
    completed_tasks: number;
    pending_tasks: number;
    overdue_tasks: number;
    total_deals: number;
    deals_this_month: number;
    total_activities: number;
    activities_this_week: number;
}

interface DataQualityStats {
    total: number;
    critical: number;
    poor: number;
    fair: number;
    average_score: number;
}

interface IndexProps extends PageProps {
    tasks: Task[];
    upcomingMeetings: any[];
    deals: Deal[];
    recentDeals: Deal[];
    poorDataQualityDeals: DataQualityRecord[];
    dataQualityStats: DataQualityStats;
    recentActivities: CommunicationActivity[];
    pipelineStages: PipelineStage[];
    overviewMetrics: OverviewMetrics;
    stats: DashboardStats;
    products: any[];
    packages: any[];
    countries: any[];
    leadAgents: any[];
}

const Index: React.FC<IndexProps> = ({
    tasks,
    upcomingMeetings,
    deals,
    recentDeals,
    poorDataQualityDeals,
    dataQualityStats,
    recentActivities,
    pipelineStages,
    overviewMetrics,
    stats,
    products,
    packages,
    countries,
    leadAgents,
}) => {
    const { props } = usePage<PageProps>();
    const company = props.company as any;
    const enableDataQualityMonitor = company?.enable_data_quality_monitor === 1; // Check if explicitly enabled (1)

    const { t } = useTranslation();
    const [activeMetric, setActiveMetric] = useState<string | null>(null);

    // Handle metric click for filtering
    const handleMetricClick = useCallback(
        (metricType: string) => {
            setActiveMetric(activeMetric === metricType ? null : metricType);

            // Navigate to appropriate page with filters
            switch (metricType) {
                case "activeLeads":
                    router.visit(route("lead-contact.index"));
                    break;
                case "openDeals":
                    router.visit(route("deals.index", { status: "open" }));
                    break;
                case "closedDeals":
                    router.visit(route("deals.index", { status: "closed" }));
                    break;
                case "pendingActivities":
                    router.visit(route("tasks.index", { status: "pending" }));
                    break;
                default:
                    break;
            }
        },
        [activeMetric],
    );

    // Handle deal operations
    const handleDealStageChange = useCallback(
        async (dealId: number, newStageId: number) => {
            try {
                await router.put(
                    route("deals.update", dealId),
                    {
                        pipeline_stage_id: newStageId,
                    },
                    {
                        preserveState: true,
                        onSuccess: () => {
                            message.success(t("messages.dealUpdateSuccess"));
                        },
                    },
                );
            } catch (error) {
                throw new Error("Failed to update deal stage");
            }
        },
        [],
    );

    return (
        <DashboardLayout>
            <PageLayout
                title={t("app.menu.dashboard")}
                breadcrumbs={[{ name: t("app.menu.dashboard") }]}
                mainContentClassName=""
            >
                <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-25">
                    {/* Overview Metrics Bar */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white"
                    >
                        {/* Background Pattern */}
                        <div className="absolute inset-0 bg-blue-900 bg-opacity-20" />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-10" />

                        <div className="relative px-8 py-16">
                            <div className="max-w-7xl mx-auto">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.2 }}
                                >
                                    <h1 className="text-4xl font-bold mb-4">
                                        {new Date().getHours() < 12
                                            ? t("app.dashboard.good_morning")
                                            : new Date().getHours() < 17
                                              ? t(
                                                    "app.dashboard.good_afternoon",
                                                )
                                              : t("app.dashboard.good_evening")}
                                        ! 👋
                                    </h1>
                                    <p className="text-xl text-blue-100 max-w-2xl">
                                        {t("app.dashboard.subtitle")}
                                    </p>
                                </motion.div>

                                {/* Floating Stats Preview */}
                                <motion.div
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.4 }}
                                    className="mt-8 flex items-center gap-8 text-sm"
                                >
                                    <div className="flex items-center gap-2">
                                        <CheckCircle
                                            size={16}
                                            className="text-green-300"
                                        />
                                        <span>
                                            {stats.completed_tasks?.toLocaleString()}{" "}
                                            {t(
                                                "app.dashboard.stat_text.tasks_completed",
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Trophy
                                            size={16}
                                            className="text-yellow-300"
                                        />
                                        <span>
                                            {stats.total_deals?.toLocaleString()}{" "}
                                            {t(
                                                "app.dashboard.stat_text.active_deals",
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Activity
                                            size={16}
                                            className="text-purple-300"
                                        />
                                        <span>
                                            {stats.activities_this_week?.toLocaleString()}{" "}
                                            {t(
                                                "app.dashboard.stat_text.activities_this_week",
                                            )}
                                        </span>
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Main Content */}
                    <div className="relative -mt-8 px-8 pb-8">
                        <div className="max-w-7xl mx-auto">
                            <OverviewMetricsBar
                                metrics={overviewMetrics}
                                onMetricClick={handleMetricClick}
                            />

                            {/* Main Workflow Panels */}
                            <Row
                                gutter={[24, 24]}
                                className="mb-8"
                                style={{
                                    display: "flex",
                                    alignItems: "stretch",
                                }}
                            >
                                {/* Left Column: Upcoming Meetings */}
                                <Col
                                    xs={24}
                                    lg={8}
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                    }}
                                >
                                    <motion.div
                                        initial={{ opacity: 0, x: -50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{
                                            duration: 0.7,
                                            delay: 0.2,
                                        }}
                                        className="h-full"
                                        style={{
                                            flex: 1,
                                            display: "flex",
                                            flexDirection: "column",
                                        }}
                                    >
                                        <MeetingsPanel
                                            meetings={upcomingMeetings}
                                        />
                                    </motion.div>

                                    {/* Tasks & Activities - Only show here when Data Quality Monitor is enabled (stacked) */}
                                    {enableDataQualityMonitor && (
                                        <motion.div
                                            initial={{ opacity: 0, x: -50 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{
                                                duration: 0.7,
                                                delay: 0.3,
                                            }}
                                            className="mt-6"
                                            style={{
                                                flex: 1,
                                                display: "flex",
                                                flexDirection: "column",
                                            }}
                                        >
                                            <TasksActivitiesPanel
                                                tasks={tasks}
                                            />
                                        </motion.div>
                                    )}
                                </Col>

                                {/* Right Column: Data Quality Monitor (when enabled) OR Tasks & Activities (when disabled) */}
                                <Col
                                    xs={24}
                                    lg={16}
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                    }}
                                >
                                    {enableDataQualityMonitor ? (
                                        <motion.div
                                            initial={{ opacity: 0, x: 50 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{
                                                duration: 0.7,
                                                delay: 0.3,
                                            }}
                                            className="h-full"
                                            style={{
                                                flex: 1,
                                                display: "flex",
                                                flexDirection: "column",
                                            }}
                                        >
                                            <DataQualityPanel
                                                records={poorDataQualityDeals}
                                                stats={dataQualityStats}
                                                countries={countries}
                                            />
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            initial={{ opacity: 0, x: 50 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{
                                                duration: 0.7,
                                                delay: 0.2,
                                            }}
                                            className="h-full"
                                            style={{
                                                flex: 1,
                                                display: "flex",
                                                flexDirection: "column",
                                            }}
                                        >
                                            <TasksActivitiesPanel
                                                tasks={tasks}
                                            />
                                        </motion.div>
                                    )}
                                </Col>
                            </Row>

                            {/* Quick Stats Footer */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.8, delay: 0.6 }}
                                className="mt-8 text-center text-gray-600"
                            >
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <div className="font-semibold text-gray-900">
                                            {stats.total_tasks?.toLocaleString()}
                                        </div>
                                        <div>
                                            {t(
                                                "pages.dashboard.stats.total_tasks",
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900">
                                            {stats.overdue_tasks?.toLocaleString()}
                                        </div>
                                        <div>
                                            {t(
                                                "pages.dashboard.stats.overdue_tasks",
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900">
                                            {stats.total_deals?.toLocaleString()}
                                        </div>
                                        <div>
                                            {t(
                                                "pages.dashboard.stats.total_deals",
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900">
                                            {stats.activities_this_week?.toLocaleString()}
                                        </div>
                                        <div>
                                            {t(
                                                "pages.dashboard.stats.weekly_activities",
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default Index;
