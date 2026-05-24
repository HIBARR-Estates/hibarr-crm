import { Deal } from "@/Types/api/deals";
import { useState } from "react";

import {
    Card,
    Row,
    Col,
    Divider,
    Typography,
    Alert,
    Button,
    Tooltip,
} from "antd";
import { RightOutlined, LockOutlined, ReloadOutlined } from "@ant-design/icons";
import DealInfoSection from "./Components/DealInfoSection";
import DealTabs from "./Components/DealTabs";
import ActivitySidebar from "./Components/ActivitySidebar";
// import "./Components/styles.css";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Note } from "@/Types/api/note";
import { DealFollowup } from "@/Types/api/deal-followup";
import { DealFile } from "@/Types/api/file";
import { Proposal } from "@/Types/api/proposal";
import QuickActions from "./Components/ActivitySidebar/QuickActions";
import { Task } from "@/Types/api/tasks";
import { CrmEventTimeline } from "@/Components/CrmEvents";
import { usePage } from "@inertiajs/react";
import usePageRefresh from "@/Hooks/usePageRefresh";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface Props extends PageProps {
    deal: Deal;
    productNames: string[];
    customFieldCategories: any[];
    fields: any[];
    notes: Note[];
    dealFollowUps: DealFollowup[];
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    files: DealFile[];
    proposals: Proposal[];
    histories: any[];
    consents: any[];
    gdprSetting: any;
    permissions: Record<string, string>;
    pageTitle: string;
    tasks: Task[];
    taskCategories: any[];
    taskLabels: any[];
    taskBoardColumns: any[];
    employees: any[];
    projects: any[];
}
const { Title } = Typography;

export const Show = ({
    deal,
    productNames,
    customFieldCategories,
    fields,
    notes,
    dealFollowUps,
    meetingTypes,
    files,
    proposals,
    histories,
    consents,
    gdprSetting,
    permissions,
    pageTitle,
    tasks,
    taskCategories,
    taskLabels,
    taskBoardColumns,
    employees,
    projects,
}: Props) => {
    const { props } = usePage<PageProps>();

    // ── Page-level refresh ──────────────────────────────────────────
    const { refresh, isRefreshing } = usePageRefresh({
        canRefresh: () => !isDealEditMode,
    });

    const [isDealEditMode, setIsDealEditMode] = useState(false);
    const { t } = useTranslation();
    const { td } = useTd();

    return (
        <>
            <PageLayout
                title={pageTitle}
                breadcrumbs={[
                    { name: t("app.menu.dashboard"), url: route("dashboard") },
                    { name: t("app.deal"), url: route("deals.index") },
                    { name: pageTitle },
                ]}
            >
                <div className="min-h-screen mx-12">
                    <div className="max-w-10xl mx-auto">
                        {/* Locked Deal Banner */}
                        {deal.is_locked && (
                            <div className="mb-4">
                                <Alert
                                    message={t("pages.deals.locked_message")}
                                    type="warning"
                                    showIcon
                                    icon={<LockOutlined />}
                                    banner
                                />
                            </div>
                        )}

                        {/* Page Header */}
                        <div className="mb-6 sm:mb-8">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                    <Title level={4} className="mb-2">
                                        {deal.is_locked && (
                                            <LockOutlined className="text-amber-500 mr-2" />
                                        )}
                                        {td(deal.name)}
                                    </Title>
                                    <div className="flex flex-col gap-3">
                                        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                                            {td(deal.pipeline?.name)}
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                            {deal.pipeline?.stages?.map(
                                                (stage, index) => {
                                                    const currentPriority =
                                                        deal.lead_stage
                                                            ?.priority || 0;
                                                    const isCompleted =
                                                        (stage?.priority || 0) <
                                                        currentPriority;
                                                    const isCurrent =
                                                        stage.id ===
                                                        deal.lead_stage?.id;

                                                    return (
                                                        <div
                                                            key={stage.id}
                                                            className="flex items-center shrink-0"
                                                        >
                                                            <div
                                                                className={`
                                                                flex items-center px-4 py-1.5 rounded-md text-sm font-bold transition-all duration-200
                                                                ${
                                                                    isCurrent
                                                                        ? "scale-105"
                                                                        : isCompleted
                                                                          ? ""
                                                                          : "opacity-60"
                                                                }
                                                            `}
                                                                style={{
                                                                    backgroundColor:
                                                                        isCurrent ||
                                                                        isCompleted
                                                                            ? `${stage.label_color}8C`
                                                                            : "#e5e7eb",
                                                                    color:
                                                                        isCurrent ||
                                                                        isCompleted
                                                                            ? "#0000008F"
                                                                            : "#4b5563",
                                                                }}
                                                            >
                                                                <div className="mr-1.5 h-2 w-2 rounded-full bg-[#0000008F]" />
                                                                {td(stage.name)}
                                                            </div>
                                                            {index <
                                                                (deal.pipeline
                                                                    ?.stages
                                                                    ?.length ||
                                                                    0) -
                                                                    1 && (
                                                                <div className="w-6 h-0.5 bg-gray-300 mx-1" />
                                                            )}
                                                        </div>
                                                    );
                                                },
                                            )}

                                            {(!deal.pipeline?.stages ||
                                                deal.pipeline.stages.length ===
                                                    0) && (
                                                <div
                                                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold"
                                                    style={{
                                                        backgroundColor: `${deal.lead_stage?.label_color}25`,
                                                        color: deal.lead_stage
                                                            ?.label_color,
                                                    }}
                                                >
                                                    <span className="mr-1.5">
                                                        •
                                                    </span>
                                                    {deal.lead_stage?.name}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* <QuickActions
                                    deal={deal}
                                    permissions={permissions}
                                /> */}
                                <Tooltip
                                    title={
                                        isDealEditMode
                                            ? t(
                                                  "pages.deals.refresh_tooltip_disabled",
                                              )
                                            : t("app.common.actions.refresh")
                                    }
                                >
                                    <Button
                                        icon={
                                            <ReloadOutlined
                                                spin={isRefreshing}
                                            />
                                        }
                                        onClick={refresh}
                                        disabled={
                                            isRefreshing || isDealEditMode
                                        }
                                        type="text"
                                    >
                                        {t("app.common.actions.refresh")}
                                    </Button>
                                </Tooltip>
                            </div>
                        </div>

                        {/* Main Content */}
                        <Row gutter={[30, 40]} className="">
                            {/* Left Column - Main Content */}
                            <Col xs={24} lg={14} xl={14}>
                                <div className="flex flex-col gap-y-4 sm:gap-y-6">
                                    {/* Deal Information Card */}
                                    <Card
                                        className="border-0 rounded-lg overflow-hidden deal-card"
                                        bodyStyle={{ padding: 0 }}
                                        variant="outlined"
                                    >
                                        <DealInfoSection
                                            deal={deal}
                                            productNames={productNames}
                                            customFieldCategories={
                                                customFieldCategories
                                            }
                                            fields={fields}
                                            permissions={permissions}
                                            tasks={tasks}
                                            taskCategories={taskCategories}
                                            taskLabels={taskLabels}
                                            taskBoardColumns={taskBoardColumns}
                                            employees={employees}
                                            projects={projects}
                                            isEditMode={isDealEditMode}
                                            onEditModeChange={setIsDealEditMode}
                                        />
                                    </Card>

                                    {/* Tabs Section */}
                                    <Card
                                        className="border-0 rounded-lg overflow-hidden deal-card"
                                        bodyStyle={{ padding: 0 }}
                                        variant="outlined"
                                    >
                                        <DealTabs
                                            deal={deal}
                                            notes={notes}
                                            dealFollowUps={dealFollowUps}
                                            meetingTypes={meetingTypes}
                                            files={files}
                                            proposals={proposals}
                                            histories={histories}
                                            consents={consents}
                                            gdprSetting={gdprSetting}
                                            permissions={permissions}
                                            tasks={tasks}
                                            taskCategories={taskCategories}
                                            taskLabels={taskLabels}
                                            taskBoardColumns={taskBoardColumns}
                                            employees={employees}
                                            projects={projects}
                                        />
                                    </Card>
                                </div>
                            </Col>

                            {/* Right Column - Activities Sidebar */}
                            <Col xs={24} lg={10} xl={10}>
                                <div className="lg:sticky lg:top-8 flex flex-col gap-y-4">
                                    {/* <ActivitySidebar
                                        deal={deal}
                                        permissions={permissions}
                                    /> */}
                                    <CrmEventTimeline
                                        modelType="App\\Models\\Deal"
                                        modelId={deal.id}
                                        userId={props.auth?.user?.id}
                                        compact={true}
                                        entityName={deal.name}
                                    />
                                </div>
                            </Col>
                        </Row>
                    </div>
                </div>
            </PageLayout>
        </>
    );
};

Show.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Show;
