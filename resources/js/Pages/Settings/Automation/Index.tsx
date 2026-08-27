import React, { useEffect } from "react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import Icon from "@/Components/Redesign/primitives/Icon";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import "@/Components/Redesign/redesign.css";

import { Automation, AutomationCatalog, AutomationStat, EmailTemplate, MetaEvent } from "./types";
import { AutomationWorkspaceProvider, useAutomationWorkspace } from "./context/AutomationWorkspaceContext";
import useAutomationNavigation from "./hooks/useAutomationNavigation";

import Overview from "./Overview";
import AutomationsList from "./AutomationsList";
import AutomationBuilder from "./AutomationBuilder";
import AutomationDetail from "./AutomationDetail";
import TemplatesList from "./TemplatesList";
import TemplateEditor from "./TemplateEditor";
import MetaEventsList from "./MetaEventsList";
import RunHistory from "./RunHistory";

type SubNavKey = "overview" | "automations" | "templates" | "metaEvents" | "logs";

interface SubNavItem {
    key: SubNavKey;
    label: string;
    icon: string;
    badge?: string;
    inGroup: (key: SubNavKey) => boolean;
}

function AutomationSettingsBody({ pageTitle }: { pageTitle: string }) {
    const { t } = useTranslation();
    const { automations, automationsLoading, templates, templatesLoading, metaEvents } = useAutomationWorkspace();
    const {
        screen,
        autoId,
        tplId,
        goOverview,
        goAutomations,
        goBuilder,
        goDetail,
        goTemplates,
        goEditor,
        goMetaEvents,
        goLogs,
    } = useAutomationNavigation();

    const currentAutomation: Automation | undefined = automations.find((a) => a.id === autoId) ?? undefined;
    const currentTemplate: EmailTemplate | undefined = templates.find((tpl) => tpl.id === tplId) ?? undefined;

    // Deep-linked (e.g. refreshed) straight into builder/detail/editor with an
    // id: automations/templates are deferred props, so on first paint they
    // may not have arrived yet — wait for them rather than momentarily
    // mounting the builder in "new automation" mode (its form state only
    // initializes once, from whatever `automation` prop it got at mount).
    const awaitingAutomation = ((screen === "builder" && autoId !== null) || screen === "detail") && automationsLoading;
    const awaitingTemplate = screen === "editor" && tplId !== null && templatesLoading;

    // A deep link with a stale/unknown id (automation deleted elsewhere, bad
    // URL) once its list has actually loaded: fall back to the list instead
    // of a dead screen.
    useEffect(() => {
        if (automationsLoading) return;
        if (screen === "detail" && !currentAutomation) goAutomations();
        if (screen === "builder" && autoId !== null && !currentAutomation) goAutomations();
    }, [automationsLoading, screen, autoId, currentAutomation, goAutomations]);

    useEffect(() => {
        if (templatesLoading) return;
        if (screen === "editor" && tplId !== null && !currentTemplate) goTemplates();
    }, [templatesLoading, screen, tplId, currentTemplate, goTemplates]);

    const inGroup = (key: SubNavKey) => {
        if (key === "automations") return screen === "automations" || screen === "builder" || screen === "detail";
        if (key === "templates") return screen === "templates" || screen === "editor";
        return screen === key;
    };

    const subnav: SubNavItem[] = [
        { key: "overview", label: t("app.automation.overview"), icon: "activity", inGroup },
        {
            key: "automations",
            label: t("app.automation.automations"),
            icon: "zap",
            badge: String(automations.length),
            inGroup,
        },
        {
            key: "templates",
            label: t("app.automation.emailTemplates"),
            icon: "mail",
            badge: String(templates.length),
            inGroup,
        },
        {
            key: "metaEvents",
            label: t("app.automation.metaEvents"),
            icon: "target",
            badge: String(metaEvents.length),
            inGroup,
        },
        { key: "logs", label: t("app.automation.runHistory"), icon: "clock", inGroup },
    ];

    const crumbLabel = (() => {
        switch (screen) {
            case "overview":
                return t("app.automation.overview");
            case "automations":
                return t("app.automation.automations");
            case "builder":
                return currentAutomation ? t("app.automation.editAutomation") : t("app.automation.newAutomation");
            case "detail":
                return currentAutomation?.name ?? t("app.automation.automations");
            case "templates":
                return t("app.automation.emailTemplates");
            case "editor":
                return currentTemplate ? t("app.automation.editTemplate") : t("app.automation.newTemplate");
            case "metaEvents":
                return t("app.automation.metaEvents");
            case "logs":
                return t("app.automation.runHistory");
        }
    })();

    return (
        <PageLayout
            title={`${pageTitle} · ${crumbLabel}`}
            breadcrumbs={[
                { name: t("app.menu.settings"), url: route("settings-overview.index") },
                { name: pageTitle, url: route("settings-automation.index") },
                { name: crumbLabel },
            ]}
        >
            <div className="flex items-start gap-6 max-w-[1320px] mx-auto">
                {/* sub-nav rail */}
                <div className="w-[236px] shrink-0 sticky top-6 flex flex-col gap-3">
                    <div className="rounded-[10px] border bg-white p-2" style={{ borderColor: T.BORDER }}>
                        <div
                            className="px-2.5 pt-2 pb-1.5"
                            style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.TEXT_HINT }}
                        >
                            {pageTitle}
                        </div>
                        {subnav.map((item) => {
                            const active = item.inGroup(item.key);
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() =>
                                        item.key === "overview"
                                            ? goOverview()
                                            : item.key === "automations"
                                              ? goAutomations()
                                              : item.key === "templates"
                                                ? goTemplates()
                                                : item.key === "metaEvents"
                                                  ? goMetaEvents()
                                                  : goLogs()
                                    }
                                    className="w-full flex items-center gap-2.5 rounded-lg mb-0.5"
                                    style={{
                                        padding: "9px 10px",
                                        border: "none",
                                        fontSize: 13,
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                        fontWeight: active ? 600 : 500,
                                        background: active ? T.BLUE_LIGHT : "none",
                                        color: active ? T.BLUE_DARK : T.TEXT_MUTED,
                                    }}
                                >
                                    <span className="flex">
                                        <Icon name={item.icon} size={16} color={active ? T.BLUE_DARK : T.TEXT_MUTED} />
                                    </span>
                                    <span className="flex-1 text-left">{item.label}</span>
                                    {item.badge && (
                                        <span
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                background: T.NAVY_SOFT,
                                                color: T.NAVY,
                                                borderRadius: 999,
                                                padding: "1px 7px",
                                            }}
                                        >
                                            {item.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* screen area */}
                <div className="flex-1 min-w-0">
                    {screen === "overview" && (
                        <Overview
                            onOpenAutomation={goDetail}
                            onNewAutomation={() => goBuilder(null)}
                            onManageAutomations={goAutomations}
                            onViewAllLogs={goLogs}
                        />
                    )}
                    {screen === "automations" && (
                        <AutomationsList onOpenDetail={goDetail} onEdit={goBuilder} onNewAutomation={() => goBuilder(null)} />
                    )}
                    {screen === "builder" && (
                        awaitingAutomation ? (
                            <EmptyState title={t("app.loading")} />
                        ) : (
                            <AutomationBuilder key={autoId ?? "new"} automation={currentAutomation} onBack={goAutomations} />
                        )
                    )}
                    {screen === "detail" && (
                        awaitingAutomation ? (
                            <EmptyState title={t("app.loading")} />
                        ) : (
                            currentAutomation && (
                                <AutomationDetail
                                    automation={currentAutomation}
                                    onBack={goAutomations}
                                    onEditFlow={() => goBuilder(currentAutomation.id)}
                                />
                            )
                        )
                    )}
                    {screen === "templates" && (
                        <TemplatesList onOpenEditor={goEditor} onNewTemplate={() => goEditor(null)} />
                    )}
                    {screen === "editor" && (
                        awaitingTemplate ? (
                            <EmptyState title={t("app.loading")} />
                        ) : (
                            <TemplateEditor key={tplId ?? "new"} template={currentTemplate} onBack={goTemplates} />
                        )
                    )}
                    {screen === "metaEvents" && <MetaEventsList onOpenAutomation={goBuilder} />}
                    {screen === "logs" && <RunHistory />}
                </div>
            </div>
        </PageLayout>
    );
}

export default function AutomationSettingsIndex({
    pageTitle,
    automations,
    automationStats,
    templates,
    metaEvents,
    catalog,
}: {
    pageTitle: string;
    automations?: Automation[];
    automationStats?: Record<number, AutomationStat>;
    templates?: EmailTemplate[];
    metaEvents?: MetaEvent[];
    catalog?: AutomationCatalog;
}) {
    return (
        <AutomationWorkspaceProvider
            automations={automations}
            automationStats={automationStats}
            templates={templates}
            metaEvents={metaEvents}
            catalog={catalog}
        >
            <AutomationSettingsBody pageTitle={pageTitle} />
        </AutomationWorkspaceProvider>
    );
}

AutomationSettingsIndex.layout = (page: React.ReactNode) => <DashboardLayout>{page}</DashboardLayout>;
