import React from "react";
import {
    Card,
    Col,
    Row,
    Tag,
    Table,
    Empty,
    Spin,
    Descriptions,
    Divider,
    Progress,
    Skeleton,
} from "antd";
import { motion } from "framer-motion";
import { Award, TrendingUp, History } from "lucide-react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { useMyLevel } from "@/Features/Mlm/api";
import {
    LevelBadge,
    ProgressToNextLevel,
    EnrollmentStatusCard,
    CycleMetricsDisplay,
} from "@/Features/Mlm/Components";
import { MLM_METRIC_LABELS } from "@/Features/Mlm/types";
import type {
    MlmLevel,
    MlmLevelCriterion,
    AgentLevelHistory,
    CriterionProgress,
    EnrollmentStatus,
    LevelData,
} from "@/Features/Mlm/types";

interface Props extends PageProps {
    levelData: LevelData;
}

const MyLevel: React.FC<Props> = ({ levelData: initialData }) => {
    const { data, isLoading } = useMyLevel();
    const levelData: LevelData = (data as any)?.data ?? initialData;

    const historyColumns = [
        {
            title: "Level",
            key: "level",
            render: (_: any, r: AgentLevelHistory) =>
                r.level ? <LevelBadge level={r.level} /> : "—",
        },
        {
            title: "Method",
            key: "method",
            render: (_: any, r: AgentLevelHistory) => (
                <Tag color={r.system_assigned ? "blue" : "gold"}>
                    {r.system_assigned ? "Automatic" : "Manual"}
                </Tag>
            ),
        },
        {
            title: "Trigger Deal",
            key: "deal",
            render: (_: any, r: AgentLevelHistory) =>
                r.trigger_deal ? (
                    <span className="text-sm">
                        {r.trigger_deal.name} ($
                        {r.trigger_deal.value?.toLocaleString()})
                    </span>
                ) : (
                    "—"
                ),
        },
        {
            title: "Date",
            dataIndex: "assigned_at",
            key: "assigned_at",
            render: (d: string) => (d ? new Date(d).toLocaleDateString() : "—"),
        },
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title="My Level"
                breadcrumbs={[
                    { name: "MLM", url: "/account/mlm/agent/dashboard" },
                    { name: "My Level" },
                ]}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    <Skeleton
                        loading={isLoading && !levelData}
                        active
                        paragraph={{ rows: 6 }}
                    >
                        {/* Enrollment Status */}
                        {(levelData?.enrollment || levelData?.active_cycle) && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className="mb-4"
                            >
                                <EnrollmentStatusCard
                                    enrollment={levelData?.enrollment ?? null}
                                    activeCycle={
                                        levelData?.active_cycle ?? null
                                    }
                                />
                            </motion.div>
                        )}

                        <Row gutter={[16, 16]}>
                            {/* Current Level Card */}
                            <Col xs={24} lg={10}>
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4 }}
                                >
                                    <Card className="shadow-sm h-full">
                                        <div className="text-center mb-6">
                                            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white mb-4">
                                                <Award size={36} />
                                            </div>
                                            <div className="text-sm text-gray-500 mb-2">
                                                Current Level
                                            </div>
                                            {levelData?.current_level ? (
                                                <LevelBadge
                                                    level={
                                                        levelData.current_level
                                                    }
                                                    showPercentage
                                                />
                                            ) : (
                                                <Tag className="text-lg">
                                                    Unranked
                                                </Tag>
                                            )}
                                        </div>

                                        <Divider />

                                        <CycleMetricsDisplay
                                            cycleMetrics={
                                                levelData?.cycle_metrics ?? null
                                            }
                                            allTimeMetrics={
                                                levelData?.metrics ?? null
                                            }
                                            showToggle
                                            compact
                                        />
                                    </Card>
                                </motion.div>
                            </Col>

                            {/* Progress to Next Level */}
                            <Col xs={24} lg={14}>
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: 0.1 }}
                                >
                                    <Card
                                        title={
                                            <div className="flex items-center gap-2">
                                                <TrendingUp
                                                    size={18}
                                                    className="text-green-500"
                                                />
                                                <span className="font-semibold">
                                                    Progress to Next Level
                                                </span>
                                                {levelData?.cycle_metrics && (
                                                    <Tag
                                                        color="blue"
                                                        className="ml-2 text-xs"
                                                    >
                                                        Current Cycle
                                                    </Tag>
                                                )}
                                            </div>
                                        }
                                        className="shadow-sm h-full"
                                    >
                                        {levelData?.next_level &&
                                        levelData?.criteria_progress?.length ? (
                                            <div>
                                                <div className="mb-4 flex items-center justify-between">
                                                    <span className="text-sm text-gray-500">
                                                        Next:{" "}
                                                        <strong>
                                                            {
                                                                levelData
                                                                    .next_level
                                                                    .name
                                                            }
                                                        </strong>
                                                    </span>
                                                    <Tag color="blue">
                                                        {
                                                            levelData.next_level
                                                                .commission_percentage
                                                        }
                                                        % commission
                                                    </Tag>
                                                </div>
                                                <ProgressToNextLevel
                                                    currentLevel={
                                                        levelData.current_level
                                                    }
                                                    nextLevel={
                                                        levelData.next_level
                                                    }
                                                    overallProgress={
                                                        (levelData.criteria_progress?.reduce(
                                                            (sum, c) =>
                                                                sum +
                                                                (c.percentage ??
                                                                    0),
                                                            0,
                                                        ) ?? 0) /
                                                        (levelData
                                                            .criteria_progress
                                                            ?.length || 1)
                                                    }
                                                    criteriaProgress={
                                                        levelData.criteria_progress
                                                    }
                                                />
                                            </div>
                                        ) : (
                                            <Empty
                                                description={
                                                    levelData?.current_level
                                                        ? "You've reached the highest level! Congratulations!"
                                                        : "Complete criteria to earn your first level."
                                                }
                                            />
                                        )}
                                    </Card>
                                </motion.div>
                            </Col>
                        </Row>

                        {/* Level History */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.2 }}
                            className="mt-6"
                        >
                            <Card
                                title={
                                    <div className="flex items-center gap-2">
                                        <History
                                            size={18}
                                            className="text-indigo-500"
                                        />
                                        <span className="font-semibold">
                                            My Level History
                                        </span>
                                    </div>
                                }
                                className="shadow-sm"
                            >
                                <Table
                                    columns={historyColumns}
                                    dataSource={levelData?.level_history ?? []}
                                    rowKey="id"
                                    pagination={false}
                                    size="small"
                                    locale={{
                                        emptyText: (
                                            <Empty description="No level changes yet" />
                                        ),
                                    }}
                                />
                            </Card>
                        </motion.div>
                    </Skeleton>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default MyLevel;
