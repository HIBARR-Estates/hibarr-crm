import React, { useState, useCallback, useMemo } from "react";
import { router, usePage } from "@inertiajs/react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Button } from "antd";
import { BookOutlined } from "@ant-design/icons";
import usePageRefresh from "@/Hooks/usePageRefresh";
import useTranslation from "@/Hooks/useTranslation";
import FilterBar from "./components/FilterBar";
import KpiCards from "./components/KpiCards";
import DeepDiveSection from "./components/DeepDiveSection";
import AiSummaryPanel from "./components/AiSummaryPanel";

interface Agent {
    id: number;
    name: string;
    image?: string | null;
}

interface Department {
    id: number;
    team_name: string;
}

interface KpiSummary {
    leads_count: number;
    deals_created_count: number;
    deals_closed_count: number;
    deals_closed_value: number;
    meetings_count: number;
    meetings_by_type: Record<string, number>;
    notes_count: number;
}

interface Filters {
    start_date: string;
    end_date: string;
    agent_id: number | null;
    view_type: "agent" | "department";
    [key: string]: any;
}

export interface ReportsPageProps extends PageProps {
    pageTitle: string;
    kpiSummary: KpiSummary;
    filters: Filters;
    agents: Agent[];
    departments: Department[];
    currentAgent: { id: number; name: string } | null;
    departmentName: string | null;
    canViewAll: boolean;
}

const Index: React.FC = () => {
    const { props } = usePage<ReportsPageProps>();
    const {
        kpiSummary,
        filters,
        agents,
        departments,
        currentAgent,
        departmentName,
        canViewAll,
    } = props;

    const [activeTab, setActiveTab] = useState<string | null>(null);
    const { refresh, isRefreshing } = usePageRefresh();

    const handleFilterChange = useCallback(
        (newFilters: Partial<Filters>) => {
            const merged = { ...filters, ...newFilters };
            router.get(
                "/account/agent-reports",
                merged as Record<string, any>,
                {
                    preserveState: true,
                    preserveScroll: true,
                },
            );
        },
        [filters],
    );

    const handleKpiClick = useCallback((tab: string) => {
        setActiveTab(tab);
    }, []);

    const contextLabel = useMemo(() => {
        if (filters.view_type === "department") {
            return departmentName ?? "Department";
        }
        return currentAgent?.name ?? "Agent";
    }, [filters.view_type, departmentName, currentAgent]);

    const { t } = useTranslation();

    return (
        <DashboardLayout>
            <PageLayout
                title={t("app.reports.title")}
                breadcrumbs={[
                    { name: t("app.menu.dashboard"), url: "/account/dashboard" },
                    { name: t("app.reports.title") },
                ]}
                onRefresh={refresh}
                isRefreshing={isRefreshing}
            >
                <div className="space-y-6">
                    <FilterBar
                        filters={filters}
                        agents={agents}
                        departments={departments}
                        canViewAll={canViewAll}
                        onChange={handleFilterChange}
                    />

                    <KpiCards
                        summary={kpiSummary}
                        onCardClick={handleKpiClick}
                    />

                    <DeepDiveSection
                        filters={filters}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                    />

                    <AiSummaryPanel
                        filters={filters}
                        contextLabel={contextLabel}
                    />

                    <div className="flex justify-end">
                        <Button
                            icon={<BookOutlined />}
                            onClick={() =>
                                router.get(
                                    "/account/agent-reports/saved-summaries",
                                )
                            }
                        >
                            View Saved AI Summaries
                        </Button>
                    </div>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default Index;
