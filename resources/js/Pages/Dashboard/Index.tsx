import React from "react";
import { motion } from "framer-motion";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import {
    CheckCircle,
    AlertTriangle,
    Trophy,
    Activity,
    TrendingUp,
    Calendar,
    Users,
    Briefcase,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

// Modern Components
import StatCard from "@/Components/Dashboard/StatCard";
import TasksWidget from "@/Components/Dashboard/TasksWidget";
import DealsWidget from "@/Components/Dashboard/DealsWidget";
import DataQualityWidget from "@/Components/Dashboard/DataQualityWidget";
import CommunicationWidget from "@/Components/Dashboard/CommunicationWidget";

dayjs.extend(relativeTime);

interface Task {
    id: number;
    heading: string;
    due_date: string;
    priority: string;
    status: string;
    project?: {
        project_name: string;
    };
    users: Array<{
        id: number;
        name: string;
        image: string;
    }>;
}

interface Deal {
    id: number;
    name: string;
    value: number;
    pipeline_stage_id: number;
    created_at: string;
    updated_at: string;
    contact?: {
        client_name: string;
        client_email: string;
    };
    lead_stage?: {
        name: string;
        label_color: string;
    };
    currency?: {
        currency_symbol: string;
    };
    data_quality_score?: number;
    missing_fields?: string[];
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

interface IndexProps extends PageProps {
    tasks: Task[];
    recentDeals: Deal[];
    poorDataQualityDeals: Deal[];
    recentActivities: CommunicationActivity[];
    stats: DashboardStats;
}

const Index: React.FC<IndexProps> = ({
    tasks,
    recentDeals,
    poorDataQualityDeals,
    recentActivities,
    stats,
}) => {
    return (
        <DashboardLayout>
            <PageLayout
                title="Dashboard"
                breadcrumbs={[{ name: "Dashboard" }]}
                mainContentClassName=""
            >
                <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-25">
                    {/* Hero Section */}
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
                                        Good{" "}
                                        {new Date().getHours() < 12
                                            ? "morning"
                                            : new Date().getHours() < 17
                                            ? "afternoon"
                                            : "evening"}
                                        ! 👋
                                    </h1>
                                    <p className="text-xl text-blue-100 max-w-2xl">
                                        Welcome back to your dashboard. Here's
                                        what's happening with your business
                                        today.
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
                                            {stats.completed_tasks} tasks
                                            completed
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Trophy
                                            size={16}
                                            className="text-yellow-300"
                                        />
                                        <span>
                                            {stats.total_deals} active deals
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Activity
                                            size={16}
                                            className="text-purple-300"
                                        />
                                        <span>
                                            {stats.activities_this_week}{" "}
                                            activities this week
                                        </span>
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Main Content */}
                    <div className="relative -mt-8 px-8 pb-8">
                        <div className="max-w-7xl mx-auto">
                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                                <StatCard
                                    title="Total Tasks"
                                    value={stats.total_tasks}
                                    icon={CheckCircle}
                                    gradient="bg-gradient-to-br from-blue-400 to-blue-600"
                                    change={{ value: 12, type: "increase" }}
                                    delay={0}
                                />
                                <StatCard
                                    title="Overdue Tasks"
                                    value={stats.overdue_tasks}
                                    icon={AlertTriangle}
                                    gradient="bg-gradient-to-br from-red-400 to-red-600"
                                    change={{ value: 8, type: "decrease" }}
                                    delay={0.1}
                                />
                                <StatCard
                                    title="Total Deals"
                                    value={stats.total_deals}
                                    icon={Trophy}
                                    gradient="bg-gradient-to-br from-emerald-400 to-emerald-600"
                                    change={{ value: 15, type: "increase" }}
                                    delay={0.2}
                                />
                                <StatCard
                                    title="Weekly Activities"
                                    value={stats.activities_this_week}
                                    icon={Activity}
                                    gradient="bg-gradient-to-br from-purple-400 to-purple-600"
                                    change={{ value: 23, type: "increase" }}
                                    delay={0.3}
                                />
                            </div>

                            {/* Main Widgets Grid */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                {/* Left Column */}
                                <div className="space-y-8">
                                    <DataQualityWidget
                                        deals={poorDataQualityDeals}
                                    />
                                </div>

                                {/* Right Column */}
                                <div className="space-y-8">
                                    <CommunicationWidget
                                        activities={recentActivities}
                                    />
                                </div>
                            </div>

                            {/* Bottom Section - Quick Actions */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: 0.8 }}
                                className="mt-12 p-8 bg-gradient-to-r from-gray-50 to-blue-50 rounded-3xl border border-gray-100"
                            >
                                <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                                    <Briefcase
                                        size={20}
                                        className="text-blue-600"
                                    />
                                    Quick Actions
                                </h3>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default Index;
