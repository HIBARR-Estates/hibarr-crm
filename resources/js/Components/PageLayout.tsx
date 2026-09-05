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
    HomeOutlined,
    ReloadOutlined,
    SettingOutlined,
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

    // Flag off preserves the exact previous default/classes at every width.
    const resolvedMainContentClassName =
        mainContentClassName ??
        (isMobileResponsive ? "px-3 sm:px-6 py-4 sm:py-6" : "px-6 py-6");
    const topbarPaddingClassName = isMobileResponsive
        ? "px-3 sm:px-6 py-3 sm:py-4"
        : "px-6 py-4";
    const topbarRowClassName = isMobileResponsive
        ? "flex items-center gap-x-3 sm:gap-x-6 flex-wrap sm:flex-nowrap"
        : "flex items-center gap-x-6";
    const searchWrapperClassName = isMobileResponsive
        ? "order-3 sm:order-none basis-full sm:basis-0 sm:flex-1"
        : "flex-1";

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
                                onSuccess: () => {
                                    // Redirect to login page on successful logout
                                    window.location.href = route("login");
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
                    className={`bg-white border-b border-gray-200 ${topbarPaddingClassName}`}
                >
                    <div className={topbarRowClassName}>
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

                                {/* Breadcrumbs */}
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
                                {/* set a max width so it doesn't stretch too far */}
                                <div className="max-w-lg mx-auto">
                                    {searchComp}
                                </div>
                            </div>
                        )}
                        <div className="ml-auto flex items-center gap-2 sm:gap-4">
                            <LanguageSwitcher />
                            <NotificationDropdown pollingInterval={30000} />
                            <Dropdown
                                menu={{ items: userMenuItems }}
                                placement="bottomLeft"
                            >
                                {/* ensure this always at the end */}
                                <div className="flex items-center justify-between cursor-pointer ml-auto">
                                    <div className="flex items-center gap-x-2">
                                        <Avatar
                                            src={user?.image_url}
                                            size="small"
                                            alt={user?.name}
                                        >
                                            {user?.name?.charAt(0)}
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium truncate">
                                                {user?.name}
                                            </span>
                                            <span className="text-xs text-gray-500 truncate">
                                                {user?.employee_detail
                                                    ?.designation?.name ??
                                                    user?.roles?.[0]
                                                        ?.display_name ??
                                                    appName}
                                            </span>
                                        </div>
                                    </div>
                                </div>
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
