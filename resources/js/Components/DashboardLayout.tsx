import React, { useState } from "react";
import { usePage } from "@inertiajs/react";
import { theme } from "antd";
import { PageProps as InertiaPageProps } from "@inertiajs/core";
import { AuthType } from "@/Types";
import Sidebar from "./Sidebar/Sidebar";

interface SidebarPermissions {
    [key: string]: number | string;
}

export interface PageProps extends InertiaPageProps {
    auth: AuthType;
    appName: string;
    sidebar: {
        permissions: Record<string, number | string>;
        modules: string[];
        unreadMessagesCount: number;
    };
    currentRouteName: string;
    // Add the index signature that Inertia expects
    [key: string]: any;
}

const DashboardLayout: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    const { props } = usePage<PageProps>();
    const {
        token: { colorBgContainer },
    } = theme.useToken();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="min-h-screen bg-slate-100">
            {/* Sidebar */}
            <Sidebar collapsed={collapsed} onCollapse={setCollapsed} />

            {/* Main Content Area */}
            <main
                className={`
                    transition-all duration-300 ease-out
                    ${collapsed ? "ml-[72px]" : "ml-[260px]"}
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

export default DashboardLayout;
