import React, { useState } from "react";
import { usePage } from "@inertiajs/react";
import { Layout, Menu, Image, theme } from "antd";

import { PageProps as InertiaPageProps, router } from "@inertiajs/core";
import { AuthType } from "@/Types";
import SupportWidget from "./SupportWidget";
import useDashboardLayoutProps from "@/Hooks/useDashboardLayoutProps";

const { Content, Sider } = Layout;

interface SidebarPermissions {
    [key: string]: number | string;
}

interface Sidebar {
    permissions: SidebarPermissions;
    modules: string[];
    unreadMessagesCount: number;
    customLinks: any[];
    worksuitePlugins: any[];
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

const siderStyle: React.CSSProperties = {
    overflow: "auto",
    height: "100vh",
    position: "sticky",
    insetInlineStart: 0,
    top: 0,
    bottom: 0,
    scrollbarWidth: "thin",
    maxWidth: "250px",
    display: "flex",
    flexDirection: "column",
    // scrollbarGutter: "stable",
};

const DashboardLayout: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    const { props } = usePage<PageProps>();
    const { auth, company, appName, sidebar, currentRouteName } = props;
    const { user } = auth;
    const { permissions, modules, unreadMessagesCount } = sidebar;

    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken();
    const [collapsed, setCollapsed] = useState(false);

    const { activeMenuKeys, menuItems, defaultOpenKeys } =
        useDashboardLayoutProps();

    console.log(permissions, modules, "what are the permissions ...");
    console.log(auth, "what are the user permissions ...");

    return (
        <Layout hasSider>
            <Sider
                style={siderStyle}
                collapsible
                collapsed={collapsed}
                onCollapse={(value) => setCollapsed(value)}
                theme={"dark"}
            >
                <div className="flex flex-col h-full">
                    {/* Sidebar Brand */}
                    <div className="px-4 flex items-center justify-center h-[69px]">
                        <Image
                            src={company?.logo_url}
                            alt={appName}
                            preview={false}
                            style={{
                                maxHeight: "50px",
                                maxWidth: "100%",
                                objectFit: "contain",
                            }}
                        />
                    </div>

                    {/* Navigation Menu */}
                    <Menu
                        // theme={user?.dark_theme ? "dark" : "light"}
                        // TODO: Update once work is finished on the dashboard layout
                        theme={"dark"}
                        mode="inline"
                        selectedKeys={activeMenuKeys}
                        defaultOpenKeys={defaultOpenKeys.filter((key) =>
                            ["dashboard", "hr", "work", "finance"].includes(key)
                        )}
                        items={menuItems}
                        className="border-none flex-1 overflow-y-auto"
                        style={{ padding: "12px 8px" }}
                    />

                    {/* Support Widget at bottom */}
                    <SupportWidget collapsed={collapsed} />
                </div>
            </Sider>

            <Layout>
                <Content
                    style={{
                        // margin: "24px 16px 0",
                        overflow: "initial",
                    }}
                >
                    <div
                        style={{
                            // padding: 24,
                            background: colorBgContainer,
                            borderRadius: borderRadiusLG,
                            minHeight: "calc(100vh - 112px)",
                        }}
                    >
                        {children}
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
};

export default DashboardLayout;
