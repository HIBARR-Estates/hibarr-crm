import { SaveTaskModal } from "@/Features/Tasks/SaveTask";
import DealOffersTab from "@/Features/Deals/DealOffersTab";
import TasksTab from "@/Components/TasksTab";
import FilesTab from "@/Pages/Deals/Components/Tabs/FilesTab";
import FollowUpTab from "@/Pages/Deals/Components/Tabs/FollowUpTab";
import NotesTab from "@/Pages/Deals/Components/Tabs/NotesTab";
import RecommendationsTab from "@/Pages/Deals/Components/Tabs/RecommendationsTab";
import AddFollowup from "@/Pages/Deals/Components/Tabs/followups/AddFollowup";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import dayjs from "dayjs";
import { ReactNode, useEffect, useMemo, useState } from "react";
import useWorkspaceOverview from "../../hooks/useWorkspaceOverview";
import { DealShowProps, WorkspaceSubTab } from "../../types";
import DealPanelHeader from "../primitives/DealPanelHeader";
import WorkspaceOverviewTab from "./WorkspaceOverviewTab";
import WorkspaceSubTabBar from "./WorkspaceSubTabBar";
import { formatPhoneNumber } from "@/lib/utils";

interface WorkspaceTabProps extends Pick<
    DealShowProps,
    | "deal"
    | "notes"
    | "tasks"
    | "dealFollowUps"
    | "files"
    | "proposals"
    | "taskCategories"
    | "taskLabels"
    | "taskBoardColumns"
    | "employees"
    | "projects"
    | "permissions"
> {
    activeSubTab: WorkspaceSubTab;
    onChangeSubTab: (tab: WorkspaceSubTab) => void;
    onSwitchToDealInfo: () => void;
}

function WorkspacePaneCard({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <section className="overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">
            <div className="border-b border-[#eef1f5] px-4 py-3">
                <h3 className="text-sm font-semibold text-[#1a1f2e]">
                    {title}
                </h3>
            </div>
            <div>{children}</div>
        </section>
    );
}

export default function WorkspaceTab({
    deal,
    notes,
    tasks,
    dealFollowUps,
    files,
    proposals,
    taskCategories,
    taskLabels,
    taskBoardColumns,
    employees,
    projects,
    permissions,
    activeSubTab,
    onChangeSubTab,
    onSwitchToDealInfo,
}: WorkspaceTabProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const [addTaskOpen, setAddTaskOpen] = useState(false);
    const [addMeetingOpen, setAddMeetingOpen] = useState(false);

    const overview = useWorkspaceOverview({ notes, tasks, dealFollowUps });
    const subTabs = useMemo(() => {
        const tabs: WorkspaceSubTab[] = ["overview"];
        if (permissions.view_deal_note !== "none") tabs.push("notes");
        if (permissions.view_tasks !== "none") tabs.push("tasks");
        if (permissions.view_lead_follow_up !== "none") tabs.push("meetings");
        if (permissions.view_lead_files !== "none") tabs.push("files");
        tabs.push("offers", "recommendations");
        return tabs;
    }, [permissions]);

    const effectiveSubTab = subTabs.includes(activeSubTab)
        ? activeSubTab
        : "overview";
    useEffect(() => {
        if (effectiveSubTab !== activeSubTab) {
            onChangeSubTab(effectiveSubTab);
        }
    }, [activeSubTab, effectiveSubTab, onChangeSubTab]);

    const counts = useMemo(
        () => ({
            notes: notes.length,
            tasks: overview.openTasksCount,
            meetings: overview.upcomingMeetingsCount,
            files: files.length,
            offers: proposals.length,
            recommendations: 0,
        }),
        [
            files.length,
            notes.length,
            overview.openTasksCount,
            overview.upcomingMeetingsCount,
            proposals.length,
        ],
    );

    const stageFocusItems = useMemo(() => {
        const checks = [
            {
                label: t("pages.deals.tabs.meeting"),
                value: deal.hibarr_fields?.strategy_meeting_booked,
            },
            {
                label: td("Downpayment paid"),
                value: deal.hibarr_fields?.downpayment_paid,
            },
            {
                label: td("Deposit confirmation"),
                value: deal.hibarr_fields?.deposit_confirmation,
            },
            {
                label: td("Reservation agreement"),
                value: deal.hibarr_fields?.reservation_agreement,
            },
            {
                label: td("Sales contract"),
                value: deal.hibarr_fields?.sales_contract,
            },
        ];
        return checks.filter((item) => !item.value);
    }, [deal.hibarr_fields, t, td]);

    const upcomingTasks = useMemo(
        () => overview.tasks.filter((task) => task.isOpen).slice(0, 2),
        [overview.tasks],
    );
    const nextMeeting = useMemo(
        () => overview.meetings.find((meeting) => meeting.isUpcoming) ?? null,
        [overview.meetings],
    );

    return (
        <>
            <SaveTaskModal
                open={addTaskOpen}
                onClose={() => setAddTaskOpen(false)}
                categories={taskCategories}
                labels={taskLabels}
                columns={taskBoardColumns}
                users={employees}
                projects={projects}
                relatedEntity={{ type: "deal", id: deal.id }}
            />
            <AddFollowup
                context="deal"
                deal={deal}
                open={addMeetingOpen}
                onClose={() => setAddMeetingOpen(false)}
            />

            <div className="space-y-4">
                <WorkspaceSubTabBar
                    activeSubTab={effectiveSubTab}
                    counts={counts}
                    visibleTabs={subTabs}
                    onChange={onChangeSubTab}
                />

                <div className="grid grid-cols-[1fr_340px] gap-[18px]">
                    <div className="space-y-4">
                        {effectiveSubTab === "overview" ? (
                            <WorkspaceOverviewTab
                                deal={deal}
                                notes={notes}
                                tasks={tasks}
                                dealFollowUps={dealFollowUps}
                                taskBoardColumns={taskBoardColumns}
                                onNavigateToSubTab={onChangeSubTab}
                                onAddTask={() => setAddTaskOpen(true)}
                                onAddMeeting={() => setAddMeetingOpen(true)}
                            />
                        ) : (
                            <>
                                {effectiveSubTab === "notes" && (
                                    <WorkspacePaneCard
                                        title={t("pages.deals.tabs.notes")}
                                    >
                                        <NotesTab
                                            deal={deal}
                                            notes={notes}
                                            permissions={permissions}
                                        />
                                    </WorkspacePaneCard>
                                )}
                                {effectiveSubTab === "tasks" && (
                                    <WorkspacePaneCard title={td("Tasks")}>
                                        <TasksTab
                                            tasks={tasks}
                                            relatedEntity={{
                                                type: "deal",
                                                id: deal.id,
                                            }}
                                            taskCategories={taskCategories}
                                            taskLabels={taskLabels}
                                            taskBoardColumns={taskBoardColumns}
                                            employees={employees}
                                            projects={projects}
                                            permissions={permissions as any}
                                        />
                                    </WorkspacePaneCard>
                                )}
                                {effectiveSubTab === "meetings" && (
                                    <WorkspacePaneCard
                                        title={t("pages.deals.tabs.meeting")}
                                    >
                                        <FollowUpTab
                                            deal={deal}
                                            followUps={dealFollowUps}
                                            permissions={permissions}
                                        />
                                    </WorkspacePaneCard>
                                )}
                                {effectiveSubTab === "files" && (
                                    <WorkspacePaneCard
                                        title={t("pages.deals.tabs.files")}
                                    >
                                        <FilesTab
                                            deal={deal}
                                            files={files}
                                            permissions={permissions}
                                        />
                                    </WorkspacePaneCard>
                                )}
                                {effectiveSubTab === "offers" && (
                                    <WorkspacePaneCard
                                        title={t("pages.deals.tabs.offers")}
                                    >
                                        <DealOffersTab deal={deal} />
                                    </WorkspacePaneCard>
                                )}
                                {effectiveSubTab === "recommendations" && (
                                    <WorkspacePaneCard
                                        title={t(
                                            "pages.deals.tabs.recommendations",
                                        )}
                                    >
                                        <RecommendationsTab
                                            deal={deal}
                                            permissions={permissions}
                                        />
                                    </WorkspacePaneCard>
                                )}
                            </>
                        )}
                    </div>
                    <aside className="space-y-3">
                        <section className="overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">
                            <DealPanelHeader title={td("Lead")} />
                            <div className="space-y-2 p-4 text-xs text-[#4b5563]">
                                <p className="text-sm font-semibold text-[#111827]">
                                    {deal.contact?.client_name_salutation ??
                                        deal.contact?.client_name ??
                                        "--"}
                                </p>
                                {deal.contact?.client_email && (
                                    <p>{deal.contact.client_email}</p>
                                )}
                                {deal.contact?.mobile && (
                                    <p>
                                        {formatPhoneNumber(deal.contact.mobile)}
                                    </p>
                                )}
                                {deal.contact?.id && (
                                    <a
                                        href={route(
                                            "lead-contact.show",
                                            deal.contact.id,
                                        )}
                                        className="font-medium text-[#1a6bb5]"
                                    >
                                        {td("Open lead profile")}
                                    </a>
                                )}
                            </div>
                        </section>

                        <section className="overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">
                            <DealPanelHeader
                                title={td("Documents and files")}
                            />
                            <div className="space-y-2 p-4 text-xs text-[#4b5563]">
                                <p>
                                    {td("Uploaded files")}: {files.length}
                                </p>
                                <p>
                                    {td("Reservation agreement")}:{" "}
                                    {deal.hibarr_fields?.reservation_agreement
                                        ? td("Yes")
                                        : td("No")}
                                </p>
                                <p>
                                    {td("Sales contract")}:{" "}
                                    {deal.hibarr_fields?.sales_contract
                                        ? td("Yes")
                                        : td("No")}
                                </p>
                                <p>
                                    {td("Deposit confirmation")}:{" "}
                                    {deal.hibarr_fields?.deposit_confirmation
                                        ? td("Yes")
                                        : td("No")}
                                </p>
                            </div>
                        </section>

                        <section className="overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">
                            <DealPanelHeader title={td("Deal details")} />
                            <div className="space-y-2 p-4 text-xs text-[#4b5563]">
                                <p>
                                    {td("Pipeline")}:{" "}
                                    {td(deal.pipeline?.name ?? "--")}
                                </p>
                                <p>
                                    {td("Stage")}:{" "}
                                    {td(deal.lead_stage?.name ?? "--")}
                                </p>
                                <p>
                                    {td("Packages")}:{" "}
                                    {deal.packages?.length ?? 0}
                                </p>
                                <p>
                                    {td("Interested in")}:{" "}
                                    {deal.hibarr_fields?.interested_in ?? "--"}
                                </p>
                            </div>
                        </section>

                        <section className="overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">
                            <DealPanelHeader title={td("Stage focus")} />
                            <div className="space-y-2 p-4 text-xs text-[#4b5563]">
                                {stageFocusItems.length === 0 ? (
                                    <p className="font-medium text-[#047857]">
                                        {td("All stage checks complete")}
                                    </p>
                                ) : (
                                    <>
                                        {stageFocusItems
                                            .slice(0, 4)
                                            .map((item) => (
                                                <p key={item.label}>
                                                    - {item.label}
                                                </p>
                                            ))}
                                        <button
                                            type="button"
                                            className="font-medium text-[#1a6bb5]"
                                            onClick={onSwitchToDealInfo}
                                        >
                                            {td("All fields")} {"->"}
                                        </button>
                                    </>
                                )}
                            </div>
                        </section>

                        <section className="overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">
                            <DealPanelHeader title={td("Upcoming tasks")} />
                            <div className="space-y-2 p-4 text-xs text-[#4b5563]">
                                {upcomingTasks.length === 0 && (
                                    <p>{td("No open tasks")}</p>
                                )}
                                {upcomingTasks.map((task) => (
                                    <p key={task.id}>
                                        <span className="font-medium text-[#111827]">
                                            {task.title}
                                        </span>
                                        {" · "}
                                        {task.dueDateLabel}
                                    </p>
                                ))}
                            </div>
                        </section>

                        <section className="overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">
                            <DealPanelHeader title={td("Next meeting")} />
                            <div className="space-y-2 p-4 text-xs text-[#4b5563]">
                                {!nextMeeting && (
                                    <p>{td("No upcoming meeting")}</p>
                                )}
                                {nextMeeting && (
                                    <>
                                        <p className="font-medium text-[#111827]">
                                            {nextMeeting.title}
                                        </p>
                                        <p>{nextMeeting.startsAtLabel}</p>
                                        <p>
                                            {td("Status")}:{" "}
                                            {td(nextMeeting.status)}
                                        </p>
                                        {nextMeeting.startsAt && (
                                            <p>
                                                {dayjs(
                                                    nextMeeting.startsAt,
                                                ).format("MMM DD, YYYY HH:mm")}
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        </section>
                    </aside>
                </div>
            </div>
        </>
    );
}
