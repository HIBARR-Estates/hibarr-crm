import React, { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import { theme } from "antd";
import { PageProps as InertiaPageProps } from "@inertiajs/core";
import { AuthType } from "@/Types";
import Sidebar from "./Sidebar/Sidebar";
import { useTranslation } from "@/Hooks/useTranslation";
import useMobileResponsiveLayoutFlag from "@/Hooks/useMobileResponsiveLayoutFlag";
import {
    MobileSidebarProvider,
    useMobileSidebar,
} from "@/contexts/MobileSidebarContext";

export interface PageProps extends InertiaPageProps {
    auth: AuthType;
    appName: string;
    featureFlags?: Record<string, boolean>;
    integrationsHubUrl?: string;
    sidebar: {
        unreadMessagesCount: number;
        customLinks?: unknown[];
        worksuitePlugins?: unknown[];
    };
    currentRouteName: string;
    // Internationalization props
    locale?: string;
    isRtl?: boolean;
    availableLocales?: Record<
        string,
        { name: string; native: string; dir: string; flag: string }
    >;
    // Add the index signature that Inertia expects
    [key: string]: any;
}

const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

const DashboardLayoutInner: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    const { isRtl } = useTranslation();
    const {
        token: { colorBgContainer },
    } = theme.useToken();
    const isMobileResponsive = useMobileResponsiveLayoutFlag();
    const { mobileOpen, closeMobileSidebar } = useMobileSidebar();
    const [collapsed, setCollapsed] = useState(() => {
        try {
            return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
        } catch {
            return false;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
        } catch {
            // ignore storage errors
        }
    }, [collapsed]);

    // Full, literal class strings (not built via string ops) so Tailwind's
    // content scanner can pick them up.
    const marginClass = isMobileResponsive
        ? isRtl
            ? collapsed
                ? "lg:mr-[72px]"
                : "lg:mr-[260px]"
            : collapsed
              ? "lg:ml-[72px]"
              : "lg:ml-[260px]"
        : isRtl
          ? collapsed
              ? "mr-[72px]"
              : "mr-[260px]"
          : collapsed
            ? "ml-[72px]"
            : "ml-[260px]";

    return (
        <div className={`min-h-screen bg-slate-100 ${isRtl ? "rtl" : "ltr"}`}>
            {/* Sidebar */}
            <Sidebar collapsed={collapsed} onCollapse={setCollapsed} />

            {/* Mobile overlay behind the off-canvas sidebar */}
            {isMobileResponsive && mobileOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 lg:hidden"
                    onClick={closeMobileSidebar}
                    aria-hidden="true"
                />
            )}

            {/* Main Content Area */}
            <main
                className={`
                    transition-all duration-300 ease-out
                    ${marginClass}
                `}
            >
                <div
                    className="min-h-screen"
                    style={{
                        background: colorBgContainer,
                    }}
                >
                    {children}
                </div>
            </main>
        </div>
    );
};

const DashboardLayout: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    return (
        <MobileSidebarProvider>
            <DashboardLayoutInner>{children}</DashboardLayoutInner>
        </MobileSidebarProvider>
    );
};

export default DashboardLayout;
