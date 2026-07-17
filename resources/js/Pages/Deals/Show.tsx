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
import {
    RightOutlined,
    LockOutlined,
    ReloadOutlined,
    CalendarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
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
import DealViewRedesign from "./Redesign/DealViewRedesign";
import EntityAiSummaryCard from "@/Components/EntitySummary/EntityAiSummaryCard";
import type { DealSummaryPayload } from "@/Types/entity-summary";

export interface DealShowPageProps extends PageProps {
    deal: Deal;
    productNames: string[];
    customFieldCategories: any[];
    fields: any[];
    meetingTypes?: Array<{ id: number; name: string; color?: string }>;
    permissions: Record<string, string>;
    pageTitle: string;
    dealAiSummary?: DealSummaryPayload | null;
    // C1 deferred — may be undefined until Inertia resolves them
    notes?: Note[];
    dealFollowUps?: DealFollowup[];
    files?: DealFile[];
    proposals?: Proposal[];
    histories?: any[];
    activities?: any[];
    consents?: any[];
    gdprSetting?: any;
    tasks?: Task[];
    taskCategories?: any[];
    taskLabels?: any[];
    taskBoardColumns?: any[];
    employees?: any[];
    projects?: any[];
}

/**
 * Shell / permission defaults only.
 * Leave C1 deferred collections undefined while pending so redesign can skeleton (C4).
 */
export function withDealShowShellDefaults(
    props: DealShowPageProps,
): DealShowPageProps {
    return {
        ...props,
        meetingTypes: props.meetingTypes ?? [],
        permissions: props.permissions ?? {},
        productNames: props.productNames ?? [],
        customFieldCategories: props.customFieldCategories ?? [],
        fields: props.fields ?? [],
    };
}

/** Legacy path: fill deferred keys so legacy tabs never see undefined iterables. */
export function withDealShowDefaults(
    props: DealShowPageProps,
): DealShowPageProps & {
    notes: Note[];
    dealFollowUps: DealFollowup[];
    files: DealFile[];
    proposals: Proposal[];
    histories: any[];
    consents: any[];
    tasks: Task[];
    taskCategories: any[];
    taskLabels: any[];
    taskBoardColumns: any[];
    employees: any[];
    projects: any[];
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    permissions: Record<string, string>;
} {
    const shell = withDealShowShellDefaults(props);
    return {
        ...shell,
        notes: shell.notes ?? [],
        dealFollowUps: shell.dealFollowUps ?? [],
        files: shell.files ?? [],
        proposals: shell.proposals ?? [],
        histories: shell.histories ?? [],
        activities: shell.activities ?? [],
        consents: shell.consents ?? [],
        gdprSetting: shell.gdprSetting ?? null,
        tasks: shell.tasks ?? [],
        taskCategories: shell.taskCategories ?? [],
        taskLabels: shell.taskLabels ?? [],
        taskBoardColumns: shell.taskBoardColumns ?? [],
        employees: shell.employees ?? [],
        projects: shell.projects ?? [],
        // Re-assert shell keys so TS intersection requires them as defined.
        meetingTypes: shell.meetingTypes ?? [],
        permissions: shell.permissions ?? {},
    };
}

type Props = DealShowPageProps;

const { Title } = Typography;

export const LegacyDealShow = ({
    deal,
    productNames,
    customFieldCategories,
    fields,
    notes = [],
    dealFollowUps = [],
    meetingTypes = [],
    files = [],
    proposals = [],
    histories = [],
    consents = [],
    gdprSetting = null,
    permissions = {},
    pageTitle,
    tasks = [],
    taskCategories = [],
    taskLabels = [],
    taskBoardColumns = [],
    employees = [],
    projects = [],
    featureFlags: pageFeatureFlags,
    dealAiSummary,
}: Props) => {
    const { props } = usePage<PageProps>();
    const featureFlags = pageFeatureFlags ?? props.featureFlags;
    const showAiSummary = featureFlags?.["sales.ai-entity-summary"] === true;

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
                    { name: td("Deals"), url: route("deals.index") },
                    { name: td(pageTitle) },
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

                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                                            <span className="inline-flex items-center gap-1">
                                                <CalendarOutlined />
                                                <span className="font-medium text-gray-600">
                                                    {t(
                                                        "pages.deals.info.fields.created_at",
                                                    )}
                                                    :
                                                </span>
                                                {deal.created_at ? (
                                                    dayjs(
                                                        deal.created_at,
                                                    ).format(
                                                        "MMM DD, YYYY HH:mm",
                                                    )
                                                ) : (
                                                    <span className="text-gray-400">
                                                        --
                                                    </span>
                                                )}
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                                <CalendarOutlined />
                                                <span className="font-medium text-gray-600">
                                                    {t(
                                                        "pages.deals.info.fields.updated_at",
                                                    )}
                                                    :
                                                </span>
                                                {deal.updated_at ? (
                                                    dayjs(
                                                        deal.updated_at,
                                                    ).format(
                                                        "MMM DD, YYYY HH:mm",
                                                    )
                                                ) : (
                                                    <span className="text-gray-400">
                                                        --
                                                    </span>
                                                )}
                                            </span>
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
                                            : td("Refresh")
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
                                        {td("Refresh")}
                                    </Button>
                                </Tooltip>
                            </div>
                        </div>

                        {/* Main Content */}
                        <Row gutter={[30, 40]} className="">
                            {/* Left Column - Main Content */}
                            <Col xs={24} lg={14} xl={14}>
                                {/* <div className="flex flex-col gap-y-4 sm:gap-y-6"> */}
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
                                {/* </div> */}
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
                        <Row gutter={[30, 40]} className="mt-8">
                            <Col xs={48} lg={24} xl={24}>
                                {showAiSummary && (
                                    <div className="mb-6">
                                        <EntityAiSummaryCard
                                            entityType="deal"
                                            entityId={deal.id}
                                            initialSummary={dealAiSummary}
                                            variant="legacy"
                                        />
                                    </div>
                                )}
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
                            </Col>
                            {/* Tabs Section */}
                        </Row>
                    </div>
                </div>
            </PageLayout>
        </>
    );
};

export const Show = (props: Props) => {
    const page = usePage<PageProps>();
    const useRedesign =
        page.props.featureFlags?.["crm.deal-view-redesign"] === true;
    // const useRedesign = true;

    return useRedesign ? (
        <DealViewRedesign
            {...withDealShowShellDefaults({
                ...props,
                notes: props?.notes ?? [],
            })}
        />
    ) : (
        <LegacyDealShow {...withDealShowDefaults(props)} />
    );
};

Show.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Show;
