import React, { useEffect } from "react";
import {
    App,
    Avatar,
    Breadcrumb,
    Button,
    Dropdown,
    MenuProps,
    Switch,
    Tooltip,
} from "antd";
import { Head, Link, router, usePage } from "@inertiajs/react";
import {
    BellOutlined,
    ControlOutlined,
    MailOutlined,
    HomeOutlined,
    ReloadOutlined,
    SettingOutlined,
    DownOutlined,
    ClockCircleOutlined,
} from "@ant-design/icons";
import { PageProps } from "./DashboardLayout";
import { MenuOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useMobileResponsiveLayoutFlag from "@/Hooks/useMobileResponsiveLayoutFlag";
import { useMobileSidebar } from "@/contexts/MobileSidebarContext";
import NotificationDropdown from "./NotificationDropdown";
import LanguageSwitcher from "./LanguageSwitcher";
import AccessInspector from "./AccessInspector";
import TimezoneIndicator from "./TimezoneIndicator";
import EmailUnreadIndicator from "@/Email/EmailUnreadIndicator";
import AgentCallAvailabilityToggle from "@/Components/Softphone/AgentCallAvailabilityToggle";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { isUserDateTimeEnabled } from "@/lib/userDateTime";
import { timezoneChipLabel } from "@/lib/timezoneLabel";

interface BreadcrumbItem {
    name: string;
    url?: string;
}

interface PageLayoutProps {
    title?: string;
    breadcrumbs?: BreadcrumbItem[];
    children: React.ReactNode;
    searchComp?: React.ReactNode;
    filterSection?: React.ReactNode;
    config?: {
        showTitle?: boolean;
    };
    mainContentClassName?: string;
    /** Callback fired when the user clicks the refresh trigger. */
    onRefresh?: () => void;
    /** Whether a refresh is currently in-flight (shows spinner & disables button). */
    isRefreshing?: boolean;
}
const defaultConfig = {
    showTitle: false,
};

/**
 * Profile avatar that displays the user photo or falls back to their initial letter
 * if no picture exists or if the picture fails to load.
 */
function UserHeaderAvatar({
    user,
}: {
    user?: { name?: string; image_url?: string; image?: string } | null;
}) {
    const photoUrl = user?.image_url?.trim() || user?.image?.trim() || "";
    const [imgFailed, setImgFailed] = React.useState(false);

    React.useEffect(() => {
        setImgFailed(false);
    }, [photoUrl]);

    const initialLetter = user?.name?.trim()?.charAt(0)?.toUpperCase() || "U";

    if (photoUrl && !imgFailed) {
        return (
            <img
                src={photoUrl}
                alt={user?.name || "User"}
                className="w-9 h-9 rounded-full object-cover shrink-0"
                style={{ width: "36px", height: "36px", borderRadius: "50%" }}
                onError={() => setImgFailed(true)}
            />
        );
    }

    return (
        <div
            className="w-9 h-9 rounded-full bg-[#6b7280] text-white flex items-center justify-center text-[14px] font-medium shrink-0 select-none"
            style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: "#6b7280",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 500,
            }}
            aria-hidden="true"
        >
            {initialLetter}
        </div>
    );
}

export default function PageLayout({
    title,
    breadcrumbs = [],
    children,
    searchComp,
    filterSection,
    config = defaultConfig,
    mainContentClassName,
    onRefresh,
    isRefreshing = false,
}: PageLayoutProps) {
    // Generate breadcrumb items
    const breadcrumbItems = [
        {
            title: (
                <Link
                    href="/account/dashboard"
                    className="text-gray-500 hover:text-blue-600"
                >
                    <HomeOutlined className="mr-1" />
                    Home
                </Link>
            ),
        },
        ...breadcrumbs.map((item, index) => ({
            title: item.url ? (
                <Link
                    href={item.url}
                    className="text-gray-500 hover:text-blue-600"
                >
                    {item.name}
                </Link>
            ) : (
                <span className="text-gray-900">{item.name}</span>
            ),
        })),
    ];

    const { message } = App.useApp();
    const { t } = useTranslation();
    const { td } = useTd();
    const isMobileResponsive = useMobileResponsiveLayoutFlag();
    const { openMobileSidebar } = useMobileSidebar();
    const { props } = usePage<PageProps>();
    const { auth, appName, flash } = props;
    const { user } = auth;
    const { timezone } = useUserDateTime();
    const tzLabel = React.useMemo(() => timezoneChipLabel(timezone), [timezone]);

    // Flag off preserves the exact previous default/classes at every width.
    const resolvedMainContentClassName =
        mainContentClassName ??
        (isMobileResponsive ? "px-3 sm:px-6 py-4 sm:py-6" : "px-6 py-6");
    const topbarPaddingClassName = isMobileResponsive
        ? "px-3 sm:px-6 py-3 sm:py-4"
        : "px-6 py-4";
    // Keep search on its own row below the app's lg (1024px) mobile cutoff.
    const topbarRowClassName = isMobileResponsive
        ? "flex items-center gap-x-3 lg:gap-x-6 gap-y-3 flex-wrap lg:flex-nowrap"
        : "flex items-center gap-x-6";
    const searchWrapperClassName = isMobileResponsive
        ? "order-last lg:order-none basis-full lg:basis-0 lg:flex-1 min-w-0"
        : "flex-1";
    const searchInnerClassName = isMobileResponsive
        ? "w-full max-w-lg mx-auto min-w-0"
        : "max-w-lg mx-auto";
    const userIdentityClassName = isMobileResponsive
        ? "hidden lg:flex flex-col min-w-0"
        : "flex flex-col";

    useEffect(() => {
        if (flash?.success) {
            message.success(flash.success);
        }
        if (flash?.error) {
            message.error(flash.error);
        }
        if (flash?.message) {
            message.info(flash.message);
        }
    }, [flash]);

    // Logout mutation
    const logoutMutation = useApiMutate<{}, any, any>(route("logout"), "POST");

    // User dropdown menu
    const userMenuItems: MenuProps["items"] = [
        ...(isUserDateTimeEnabled()
            ? [
                  {
                      key: "timezone-row",
                      disabled: true,
                      label: (
                          <div
                              style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  padding: "4px 4px",
                                  fontSize: "12px",
                                  color: "#4b5563",
                                  fontWeight: 500,
                                  cursor: "default",
                                  userSelect: "none",
                              }}
                          >
                              <ClockCircleOutlined style={{ fontSize: 13, color: "#6b7280" }} />
                              <span>{tzLabel}</span>
                          </div>
                      ),
                  },
                  {
                      type: "divider" as const,
                  },
              ]
            : []),
        // {
        //     key: "settings",
        //     icon: <SettingOutlined />,
        //     label: t("app.menu.settings"),
        //     onClick: () => router.visit("/account/settings/profile"),
        // },
        {
            key: "preferences",
            icon: <ControlOutlined />,
            label: t("app.menu.settings_menu.preferences"),
            onClick: () => router.visit("/account/settings/preferences"),
        },
        ...(props.emailMailbox?.settingsUrl
            ? [
                  {
                      key: "mailbox",
                      icon: <MailOutlined />,
                      label: t("app.menu.settings_menu.mailbox"),
                      onClick: () =>
                          router.visit(props.emailMailbox.settingsUrl),
                  },
              ]
            : []),
        ...(props.emailPilot?.manageUrl
            ? [
                  {
                      key: "email-pilot",
                      icon: <MailOutlined />,
                      label: t("app.menu.settings_menu.email_pilot"),
                      onClick: () =>
                          router.visit(props.emailPilot.manageUrl),
                  },
              ]
            : []),
        {
            key: "reminder-preferences",
            icon: <BellOutlined />,
            label: t("app.menu.settings_menu.reminder_preferences"),
            onClick: () =>
                router.visit("/account/settings/reminder-preferences/manage"),
        },
        {
            type: "divider",
        },
        {
            key: "logout",
            label: (
                <span
                    onClick={() => {
                        logoutMutation.mutate(
                            {},
                            {
                                onSuccess: (res) => {
                                    // The server returns the Keycloak end-session URL so
                                    // the SSO session ends too; fall back to the login page.
                                    window.location.href =
                                        (res as { url?: string } | undefined)
                                            ?.url ?? route("login");
                                },
                            },
                        );
                    }}
                    className="w-full text-left cursor-pointer"
                >
                    Logout
                </span>
            ),
        },
    ];

    return (
        <>
            <Head title={title} />

            <div className="min-h-screen bg-gray-100">
                {/* Page Header/Topbar */}
                <div
                    className="bg-white border-b border-gray-200"
                    style={{
                        backgroundColor: "#ffffff",
                        borderBottom: "1px solid #e5e7eb",
                        minHeight: "68px",
                        padding: isMobileResponsive ? "10px 16px" : "10px 28px",
                        display: "flex",
                        alignItems: "center",
                    }}
                >
                    <div
                        className="w-full flex items-center justify-between flex-wrap gap-y-3"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            width: "100%",
                        }}
                    >
                        {/* Left: Mobile Toggle, Title, Breadcrumbs, Search */}
                        <div className="flex items-center gap-3 min-w-0">
                            {isMobileResponsive && (
                                <button
                                    type="button"
                                    onClick={openMobileSidebar}
                                    aria-label={td("Open menu", { source: "en" })}
                                    className="lg:hidden flex items-center justify-center w-11 h-11 -ml-2 flex-shrink-0 rounded-lg text-gray-600 hover:bg-gray-100"
                                >
                                    <MenuOutlined className="text-lg" />
                                </button>
                            )}
                            <div className="min-w-0">
                                <div className="flex items-center space-x-3">
                                    {config.showTitle && (
                                        <h1 className="text-lg font-semibold text-gray-900 truncate max-w-[60vw] sm:max-w-xs">
                                            {title}
                                        </h1>
                                    )}

                                    {/* Breadcrumbs - kept exactly as current per instructions */}
                                    <div className="hidden lg:flex">
                                        <Breadcrumb
                                            separator="•"
                                            items={breadcrumbItems}
                                            className="text-xs text-gray-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Search Component */}
                            {searchComp && (
                                <div className={searchWrapperClassName}>
                                    <div className={searchInnerClassName}>
                                        {searchComp}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right: Access, Language, Call Availability, Messages, Notifications, Profile (8px gaps) */}
                        <div
                            className="flex items-center flex-wrap shrink-0"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                flexWrap: "wrap",
                                marginLeft: "auto",
                            }}
                        >
                            {/* 1. Access button (admin only) */}
                            <AccessInspector />

                            {/* 2. Language switcher */}
                            <LanguageSwitcher />

                            {/* 3. Call availability switch (primary accent) */}
                            <AgentCallAvailabilityToggle />

                            {/* 4. Messages icon button */}
                            <EmailUnreadIndicator />

                            {/* 5. Notifications icon button */}
                            <NotificationDropdown pollingInterval={30000} />

                            {/* 6. Profile menu trigger */}
                            <Dropdown
                                menu={{ items: userMenuItems }}
                                placement="bottomRight"
                                trigger={["click"]}
                            >
                                <button
                                    type="button"
                                    className="flex items-center gap-2 h-12 px-2 rounded-lg bg-transparent hover:bg-gray-50 border-0 cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    style={{
                                        height: "48px",
                                        border: "none",
                                        background: "transparent",
                                        padding: "0 8px",
                                        cursor: "pointer",
                                    }}
                                    aria-label="User account menu"
                                >
                                    <UserHeaderAvatar user={user} />
                                    <div className="hidden sm:flex flex-col min-w-0">
                                        <span
                                            className="text-[14px] font-semibold text-[#0f1f3d] leading-tight truncate"
                                            style={{
                                                fontSize: "14px",
                                                fontWeight: 600,
                                                color: "#0f1f3d",
                                                lineHeight: 1.2,
                                            }}
                                        >
                                            {user?.name}
                                        </span>
                                        <span
                                            className="text-[12px] text-[#4b5563] leading-tight truncate"
                                            style={{
                                                fontSize: "12px",
                                                color: "#4b5563",
                                                lineHeight: 1.2,
                                            }}
                                        >
                                            {user?.employee_detail?.designation?.name ??
                                                user?.roles?.[0]?.display_name ??
                                                appName}
                                        </span>
                                    </div>
                                    <DownOutlined style={{ fontSize: 14, color: "#6b7280" }} aria-hidden="true" />
                                </button>
                            </Dropdown>
                        </div>
                    </div>
                </div>

                {/* Filter Section */}
                {filterSection && (
                    <div className="bg-gray-50 border-b border-gray-50">
                        {filterSection}
                    </div>
                )}

                {/* Main Content */}
                <div className={resolvedMainContentClassName}>{children}</div>
            </div>
        </>
    );
}
