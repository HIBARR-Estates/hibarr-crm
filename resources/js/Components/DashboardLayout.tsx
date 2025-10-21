import React, { useState } from "react";
import { usePage } from "@inertiajs/react";
import { Layout, Menu, Avatar, Dropdown, Switch, theme } from "antd";
import type { MenuProps } from "antd";
import {
    HouseIcon,
    CalendarIcon,
    PersonIcon,
    BuildingIcon,
    PeopleIcon,
    BriefcaseIcon,
    CashCoinIcon,
    BasketIcon,
    HouseDoorIcon,
    GearIcon,
} from "./icons";
import { PageProps as InertiaPageProps, router } from "@inertiajs/core";

const { Header, Content, Sider } = Layout;

interface User {
    id: number;
    name: string;
    email: string;
    image_url: string;
    dark_theme: boolean;
    designation: string;
    roles: string[];
}

interface Company {
    app_name: string;
    logo_url: string;
    favicon_url: string;
    currency_id: number;
}

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
    auth: {
        user: User;
    };
    company: Company;
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
    scrollbarGutter: "stable",
};

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const { props } = usePage<PageProps>();
    const { auth, company, appName, sidebar, currentRouteName } = props;
    const { user } = auth;
    const { permissions, modules, unreadMessagesCount } = sidebar;

    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken();
    const [collapsed, setCollapsed] = useState(false);

    // Helper functions
    const hasModule = (module: string): boolean => modules.includes(module);
    const hasPermission = (permission: string, level: number = 4): boolean => {
        const userPermission = permissions[permission];
        return userPermission === level || userPermission === "all";
    };
    const isInRole = (role: string): boolean =>
        user?.roles?.includes(role) ?? false;

    // Build menu items
    const buildMenuItems = (): MenuProps["items"] => {
        const items: MenuProps["items"] = [];

        // Dashboard
        if (
            isInRole("admin") ||
            hasPermission("view_overview_dashboard") ||
            hasPermission("view_project_dashboard") ||
            hasPermission("view_client_dashboard") ||
            hasPermission("view_hr_dashboard") ||
            hasPermission("view_ticket_dashboard") ||
            hasPermission("view_finance_dashboard")
        ) {
            items.push({
                key: "dashboard",
                label: <a href={route("dashboard")}>Dashboard</a>,
                icon: <HouseIcon />,
                children: [
                    {
                        key: "private-dashboard",
                        label: (
                            <a href={route("dashboard")}>Private Dashboard</a>
                        ),
                    },
                    {
                        key: "advanced-dashboard",
                        label: (
                            <a href={route("dashboard.advanced")}>
                                Advanced Dashboard
                            </a>
                        ),
                    },
                ],
            });
        }

        // My Calendar
        if (
            hasModule("tasks") ||
            hasModule("events") ||
            hasModule("holidays") ||
            hasModule("tickets") ||
            hasModule("leaves")
        ) {
            items.push({
                key: "my-calendar",
                label: <a href={route("my-calendar.index")}>My Calendar</a>,
                icon: <CalendarIcon />,
            });
        }

        // Leads
        if (
            !isInRole("client") &&
            hasModule("leads") &&
            (hasPermission("view_lead") || hasPermission("view_deals"))
        ) {
            const leadChildren: MenuProps["items"] = [];

            if (hasPermission("view_lead")) {
                leadChildren.push({
                    key: "lead-contact",
                    label: (
                        <a href={route("lead-contact.index")}>Lead Contact</a>
                    ),
                });
            }

            if (hasPermission("view_deals")) {
                leadChildren.push({
                    key: "deals",
                    label: <a href={route("leadboards.index")}>Deals</a>,
                });
            }

            items.push({
                key: "leads",
                label: "Leads",
                icon: <PersonIcon />,
                children: leadChildren,
            });
        }

        // Clients
        if (
            !isInRole("client") &&
            hasModule("clients") &&
            hasPermission("view_clients")
        ) {
            items.push({
                key: "clients",
                label: <a href={route("clients.index")}>Clients</a>,
                icon: <BuildingIcon />,
            });
        }

        // HR
        if (
            !isInRole("client") &&
            (hasModule("employees") ||
                hasModule("leaves") ||
                hasModule("attendance") ||
                hasModule("holidays")) &&
            (hasPermission("view_employees") ||
                hasPermission("view_leave") ||
                hasPermission("view_attendance") ||
                hasPermission("view_holiday"))
        ) {
            const hrChildren: MenuProps["items"] = [];

            if (hasModule("employees") && hasPermission("view_employees")) {
                hrChildren.push({
                    key: "employees",
                    label: <a href={route("employees.index")}>Employees</a>,
                });
            }

            if (hasModule("leaves") && hasPermission("view_leave")) {
                hrChildren.push({
                    key: "leaves",
                    label: <a href={route("leaves.index")}>Leaves</a>,
                });
            }

            if (hasModule("attendance") && hasPermission("view_attendance")) {
                hrChildren.push({
                    key: "attendance",
                    label: <a href={route("attendances.index")}>Attendance</a>,
                });
            }

            if (hasModule("holidays") && hasPermission("view_holiday")) {
                hrChildren.push({
                    key: "holidays",
                    label: <a href={route("holidays.index")}>Holidays</a>,
                });
            }

            items.push({
                key: "hr",
                label: "HR",
                icon: <PeopleIcon />,
                children: hrChildren,
            });
        }

        // Work
        if (
            (hasModule("contracts") ||
                hasModule("projects") ||
                hasModule("tasks") ||
                hasModule("timelogs")) &&
            (hasPermission("view_contract") ||
                hasPermission("view_projects") ||
                hasPermission("view_tasks") ||
                hasPermission("view_timelogs"))
        ) {
            const workChildren: MenuProps["items"] = [];

            if (hasModule("contracts") && hasPermission("view_contract")) {
                workChildren.push({
                    key: "contracts",
                    label: <a href={route("contracts.index")}>Contracts</a>,
                });
            }

            if (hasModule("projects") && hasPermission("view_projects")) {
                workChildren.push({
                    key: "projects",
                    label: <a href={route("projects.index")}>Projects</a>,
                });
            }

            if (hasModule("tasks") && hasPermission("view_tasks")) {
                workChildren.push({
                    key: "tasks",
                    label: <a href={route("tasks.index")}>Tasks</a>,
                });
            }

            if (hasModule("timelogs") && hasPermission("view_timelogs")) {
                workChildren.push({
                    key: "timelogs",
                    label: <a href={route("timelogs.index")}>Time Logs</a>,
                });
            }

            items.push({
                key: "work",
                label: "Work",
                icon: <BriefcaseIcon />,
                children: workChildren,
            });
        }

        // Finance
        if (
            (hasModule("estimates") ||
                hasModule("invoices") ||
                hasModule("payments") ||
                hasModule("expenses") ||
                hasModule("bankaccount")) &&
            (hasPermission("view_estimates") ||
                hasPermission("view_invoices") ||
                hasPermission("view_payments") ||
                hasPermission("view_expenses") ||
                hasPermission("view_bankaccount"))
        ) {
            const financeChildren: MenuProps["items"] = [];

            if (hasModule("estimates") && hasPermission("view_estimates")) {
                financeChildren.push({
                    key: "estimates",
                    label: <a href={route("estimates.index")}>Estimates</a>,
                });
            }

            if (hasModule("invoices") && hasPermission("view_invoices")) {
                financeChildren.push({
                    key: "invoices",
                    label: <a href={route("invoices.index")}>Invoices</a>,
                });
            }

            if (hasModule("payments") && hasPermission("view_payments")) {
                financeChildren.push({
                    key: "payments",
                    label: <a href={route("payments.index")}>Payments</a>,
                });
            }

            items.push({
                key: "finance",
                label: "Finance",
                icon: <CashCoinIcon />,
                children: financeChildren,
            });
        }

        // Products
        if (hasModule("products") && hasPermission("view_product")) {
            items.push({
                key: "products",
                label: <a href={route("products.index")}>Products</a>,
                icon: <BasketIcon />,
            });
        }

        // Properties
        if (hasModule("products") && hasPermission("view_product")) {
            items.push({
                key: "properties",
                label: <a href={route("properties.index")}>Properties</a>,
                icon: <HouseDoorIcon />,
            });
        }

        // Settings
        items.push({
            key: "settings",
            label: (
                <a
                    href={
                        hasPermission("manage_company_setting", 4)
                            ? route("company-settings.index")
                            : route("profile-settings.index")
                    }
                >
                    Settings
                </a>
            ),
            icon: <GearIcon />,
        });

        return items;
    };

    // User dropdown menu
    const userMenuItems: MenuProps["items"] = [
        {
            key: "profile",
            label: (
                <a href={route("profile-settings.index")}>Profile Settings</a>
            ),
        },
        {
            key: "dark-theme",
            label: (
                <div className="flex justify-between items-center">
                    <span>Dark Theme</span>
                    <Switch
                        size="small"
                        checked={user?.dark_theme}
                        onChange={(checked) => {
                            // Implement dark theme toggle
                            // console.log("Toggle dark theme:", checked);
                        }}
                    />
                </div>
            ),
        },
        {
            type: "divider",
        },
        {
            key: "logout",
            label: (
                <span
                    onClick={() => {
                        router.post(
                            route("logout"),
                            {},
                            {
                                onSuccess: () => {
                                    window.location.href = route("login");
                                },
                            }
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
        <Layout hasSider>
            <Sider
                style={siderStyle}
                collapsible
                collapsed={collapsed}
                onCollapse={(value) => setCollapsed(value)}
                theme={"dark"}
            >
                {/* Sidebar Brand */}
                <div className="p-4 border-b">
                    <Dropdown
                        menu={{ items: userMenuItems }}
                        placement="bottomLeft"
                    >
                        <div className="flex items-center justify-between cursor-pointer">
                            {!collapsed && (
                                <div className="flex items-center space-x-2">
                                    <Avatar
                                        src={user?.image_url}
                                        size="small"
                                        alt={user?.name}
                                    >
                                        {user?.name?.charAt(0)}
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium truncate">
                                            {appName}
                                        </span>
                                        <span className="text-xs text-gray-500 truncate">
                                            {user?.name}
                                        </span>
                                    </div>
                                </div>
                            )}
                            {collapsed && (
                                <Avatar
                                    src={company?.logo_url}
                                    size="small"
                                    alt={appName}
                                >
                                    {appName?.charAt(0)}
                                </Avatar>
                            )}
                        </div>
                    </Dropdown>
                </div>

                {/* Navigation Menu */}
                <Menu
                    // theme={user?.dark_theme ? "dark" : "light"}
                    // TODO: Update once work is finished on the dashboard layout
                    theme={"dark"}
                    mode="inline"
                    selectedKeys={[currentRouteName]}
                    items={buildMenuItems()}
                    className="border-none"
                />
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
