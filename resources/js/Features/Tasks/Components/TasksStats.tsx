import React from "react";
import { Row, Col, Card, Statistic, Progress, Space } from "antd";
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    CalendarOutlined,
    TrophyOutlined,
    FireOutlined,
} from "@ant-design/icons";

interface TaskStats {
    total: number;
    completed: number;
    overdue: number;
    dueToday: number;
}

interface TasksStatsProps {
    stats: TaskStats;
    loading?: boolean;
}

export const TasksStats: React.FC<TasksStatsProps> = ({
    stats,
    loading = false,
}) => {
    const { total, completed, overdue, dueToday } = stats;

    // Calculate completion percentage
    const completionPercentage =
        total > 0 ? Math.round((completed / total) * 100) : 0;

    // Calculate progress color
    const getProgressColor = (percentage: number) => {
        if (percentage >= 80) return "#52c41a";
        if (percentage >= 60) return "#1890ff";
        if (percentage >= 40) return "#faad14";
        return "#ff4d4f";
    };

    return (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
                <Card size="small">
                    <Statistic
                        title="Total Tasks"
                        value={total}
                        loading={loading}
                        prefix={
                            <CheckCircleOutlined style={{ color: "#1890ff" }} />
                        }
                        valueStyle={{ color: "#1890ff" }}
                    />
                    <div style={{ marginTop: 8 }}>
                        <Progress
                            percent={100}
                            size="small"
                            showInfo={false}
                            strokeColor="#1890ff"
                            trailColor="#f0f0f0"
                        />
                    </div>
                </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
                <Card size="small">
                    <Statistic
                        title="Completed"
                        value={completed}
                        loading={loading}
                        prefix={<TrophyOutlined style={{ color: "#52c41a" }} />}
                        suffix={total > 0 ? `/ ${total}` : ""}
                        valueStyle={{ color: "#52c41a" }}
                    />
                    <div style={{ marginTop: 8 }}>
                        <Progress
                            percent={completionPercentage}
                            size="small"
                            strokeColor={getProgressColor(completionPercentage)}
                            format={(percent) => `${percent}%`}
                        />
                    </div>
                </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
                <Card size="small">
                    <Statistic
                        title="Due Today"
                        value={dueToday}
                        loading={loading}
                        prefix={
                            <CalendarOutlined style={{ color: "#faad14" }} />
                        }
                        valueStyle={{ color: "#faad14" }}
                    />
                    <div style={{ marginTop: 8 }}>
                        <Space>
                            <ClockCircleOutlined
                                style={{ color: "#faad14", fontSize: 12 }}
                            />
                            <span style={{ fontSize: 12, color: "#666" }}>
                                Requires attention
                            </span>
                        </Space>
                    </div>
                </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
                <Card size="small">
                    <Statistic
                        title="Overdue"
                        value={overdue}
                        loading={loading}
                        prefix={<FireOutlined style={{ color: "#ff4d4f" }} />}
                        valueStyle={{ color: "#ff4d4f" }}
                    />
                    <div style={{ marginTop: 8 }}>
                        <Space>
                            <ExclamationCircleOutlined
                                style={{ color: "#ff4d4f", fontSize: 12 }}
                            />
                            <span style={{ fontSize: 12, color: "#666" }}>
                                {overdue > 0
                                    ? "Needs immediate action"
                                    : "All caught up!"}
                            </span>
                        </Space>
                    </div>
                </Card>
            </Col>
        </Row>
    );
};
