import React, { useState } from "react";
import { router, usePage } from "@inertiajs/react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import { Drawer, Switch, Tooltip } from "antd";
import {
    BriefcaseIcon,
    PersonIcon,
    CalendarIcon,
    CheckSquareIcon,
} from "../../Components/icons";
import {
    FileTextOutlined,
    BellOutlined,
    NotificationOutlined,
    ThunderboltOutlined,
} from "@ant-design/icons";
import TaskCategoryManager from "./TaskCategoryManager";
import { usePermission, isPermissionAll } from "../../lib/permissionUtils";

interface EntitySettingCard {
    key: string;
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    title: string;
    description: string;
    connected: boolean;
    onOpen?: () => void;
}

export default function SettingsIndex({
    pageTitle,
}: {
    pageTitle: string;
}) {
    const { t } = useTranslation();
    const { permissions } = usePermission();
    const canManageNotifications = isPermissionAll(
        permissions.manage_notification_setting,
    );
    const [taskCategoriesOpen, setTaskCategoriesOpen] = useState(false);
    const pageProps = usePage().props as {
        featureFlags?: Record<string, boolean>;
    };
    const automationV2Enabled =
        pageProps.featureFlags?.["crm.automation-v2"] === true;

    const cards: EntitySettingCard[] = [
        {
            key: "automation",
            icon: <ThunderboltOutlined />,
            iconBg: "bg-indigo-50",
            iconColor: "text-indigo-500",
            title: t("app.menu.automation"),
            description: t("app.settingsHub.automationDesc"),
            connected: true,
            onOpen: () =>
                router.visit(
                    automationV2Enabled
                        ? route("settings-automation.index")
                        : route("company-settings.deal_automations"),
                ),
        },
        {
            key: "leads",
            icon: <PersonIcon />,
            iconBg: "bg-purple-50",
            iconColor: "text-purple-500",
            title: t("app.menu.lead"),
            description: t("app.settingsHub.leadsDesc"),
            connected: false,
        },
        {
            key: "deals",
            icon: <BriefcaseIcon />,
            iconBg: "bg-blue-50",
            iconColor: "text-blue-500",
            title: t("app.menu.deal"),
            description: t("app.settingsHub.dealsDesc"),
            connected: true,
            onOpen: () => router.visit(route("analysis-script-builder.show")),
        },
        {
            key: "meetings",
            icon: <CalendarIcon />,
            iconBg: "bg-amber-50",
            iconColor: "text-amber-500",
            title: t("app.menu.meetings"),
            description: t("app.settingsHub.meetingsDesc"),
            connected: false,
        },
        {
            key: "tasks",
            icon: <CheckSquareIcon />,
            iconBg: "bg-green-50",
            iconColor: "text-green-500",
            title: t("modules.tasks.taskCategory"),
            description: t("app.settingsHub.tasksDesc"),
            connected: true,
            onOpen: () => setTaskCategoriesOpen(true),
        },
        {
            key: "notes",
            icon: <FileTextOutlined />,
            iconBg: "bg-pink-50",
            iconColor: "text-pink-500",
            title: t("app.menu.notes"),
            description: t("app.settingsHub.notesDesc"),
            connected: false,
        },
        {
            key: "reminders",
            icon: <BellOutlined />,
            iconBg: "bg-cyan-50",
            iconColor: "text-cyan-500",
            title: t("app.settingsHub.reminders"),
            description: t("app.settingsHub.remindersDesc"),
            connected: false,
        },
        ...(canManageNotifications
            ? [
                  {
                      key: "notifications",
                      icon: <NotificationOutlined />,
                      iconBg: "bg-indigo-50",
                      iconColor: "text-indigo-500",
                      title: t("app.menu.notificationSettings"),
                      description: t("app.settingsHub.notificationsDesc"),
                      connected: true,
                      onOpen: () =>
                          router.visit(
                              route("notification-settings-manager.index"),
                          ),
                  },
              ]
            : []),
    ];

    return (
        <PageLayout
            breadcrumbs={[{ name: pageTitle }]}
            config={{ showTitle: true }}
        >
            <div className="max-w-screen-2xl mx-auto w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map((card) => (
                    <div
                        key={card.key}
                        className={`
                            rounded-xl border bg-white p-5 flex flex-col gap-3 transition-shadow
                            ${
                                card.connected
                                    ? "border-[#1890ff] shadow-sm cursor-pointer hover:shadow-md"
                                    : "border-gray-100"
                            }
                        `}
                        onClick={card.onOpen}
                        role={card.onOpen ? "button" : undefined}
                        tabIndex={card.onOpen ? 0 : undefined}
                        onKeyDown={
                            card.onOpen
                                ? (e) => {
                                      // Ignore keydowns bubbling up from a nested
                                      // control (e.g. the Manage button) — only
                                      // react when the card itself has focus, or
                                      // Enter/Space on Manage double-fires onOpen.
                                      if (e.target !== e.currentTarget) return;
                                      if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          card.onOpen?.();
                                      }
                                  }
                                : undefined
                        }
                    >
                        <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${card.iconBg} ${card.iconColor}`}
                        >
                            {card.icon}
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-gray-800">
                                {card.title}
                            </div>
                            <div className="text-xs text-gray-400 mt-1 leading-relaxed">
                                {card.description}
                            </div>
                        </div>

                        <div
                            className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {card.connected ? (
                                <button
                                    type="button"
                                    className="text-xs font-medium text-[#1890ff] hover:underline"
                                    onClick={card.onOpen}
                                >
                                    {t("app.settingsHub.manage")}
                                </button>
                            ) : (
                                <>
                                    <span className="text-xs text-gray-300">
                                        {t("app.settingsHub.comingSoon")}
                                    </span>
                                    <Tooltip
                                        title={t(
                                            "app.settingsHub.comingSoon",
                                        )}
                                    >
                                        <Switch size="small" disabled />
                                    </Tooltip>
                                </>
                            )}
                        </div>
                    </div>
                ))}
                </div>
            </div>

            <Drawer
                title={t("modules.tasks.taskCategory")}
                open={taskCategoriesOpen}
                onClose={() => setTaskCategoriesOpen(false)}
                width={560}
                destroyOnClose
                maskClosable={false}
                styles={{ content: { boxShadow: "none" }, wrapper: { boxShadow: "none" } }}
            >
                <TaskCategoryManager />
            </Drawer>
        </PageLayout>
    );
}

SettingsIndex.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);
