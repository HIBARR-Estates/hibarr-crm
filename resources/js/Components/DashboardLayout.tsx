import React, { useState } from "react";
import { Link, usePage } from "@inertiajs/react";
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
import { PageProps as InertiaPageProps } from "@inertiajs/core";

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
                label: <Link href={route("dashboard")}>Dashboard</Link>,
                icon: <HouseIcon />,
                children: [
                    {
                        key: "private-dashboard",
                        label: (
                            <Link href={route("dashboard")}>
                                Private Dashboard
                            </Link>
                        ),
                    },
                    {
                        key: "advanced-dashboard",
                        label: (
                            <Link href={route("dashboard.advanced")}>
                                Advanced Dashboard
                            </Link>
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
                label: (
                    <Link href={route("my-calendar.index")}>My Calendar</Link>
                ),
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
                        <Link href={route("lead-contact.index")}>
                            Lead Contact
                        </Link>
                    ),
                });
            }

            if (hasPermission("view_deals")) {
                leadChildren.push({
                    key: "deals",
                    label: <Link href={route("leadboards.index")}>Deals</Link>,
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
                label: <Link href={route("clients.index")}>Clients</Link>,
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
                    label: (
                        <Link href={route("employees.index")}>Employees</Link>
                    ),
                });
            }

            if (hasModule("leaves") && hasPermission("view_leave")) {
                hrChildren.push({
                    key: "leaves",
                    label: <Link href={route("leaves.index")}>Leaves</Link>,
                });
            }

            if (hasModule("attendance") && hasPermission("view_attendance")) {
                hrChildren.push({
                    key: "attendance",
                    label: (
                        <Link href={route("attendances.index")}>
                            Attendance
                        </Link>
                    ),
                });
            }

            if (hasModule("holidays") && hasPermission("view_holiday")) {
                hrChildren.push({
                    key: "holidays",
                    label: <Link href={route("holidays.index")}>Holidays</Link>,
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
                    label: (
                        <Link href={route("contracts.index")}>Contracts</Link>
                    ),
                });
            }

            if (hasModule("projects") && hasPermission("view_projects")) {
                workChildren.push({
                    key: "projects",
                    label: <Link href={route("projects.index")}>Projects</Link>,
                });
            }

            if (hasModule("tasks") && hasPermission("view_tasks")) {
                workChildren.push({
                    key: "tasks",
                    label: <Link href={route("tasks.index")}>Tasks</Link>,
                });
            }

            if (hasModule("timelogs") && hasPermission("view_timelogs")) {
                workChildren.push({
                    key: "timelogs",
                    label: (
                        <Link href={route("timelogs.index")}>Time Logs</Link>
                    ),
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
                    label: (
                        <Link href={route("estimates.index")}>Estimates</Link>
                    ),
                });
            }

            if (hasModule("invoices") && hasPermission("view_invoices")) {
                financeChildren.push({
                    key: "invoices",
                    label: <Link href={route("invoices.index")}>Invoices</Link>,
                });
            }

            if (hasModule("payments") && hasPermission("view_payments")) {
                financeChildren.push({
                    key: "payments",
                    label: <Link href={route("payments.index")}>Payments</Link>,
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
                label: <Link href={route("products.index")}>Products</Link>,
                icon: <BasketIcon />,
            });
        }

        // Properties
        if (hasModule("products") && hasPermission("view_product")) {
            items.push({
                key: "properties",
                label: <Link href={route("properties.index")}>Properties</Link>,
                icon: <HouseDoorIcon />,
            });
        }

        // Settings
        items.push({
            key: "settings",
            label: (
                <Link
                    href={
                        hasPermission("manage_company_setting", 4)
                            ? route("company-settings.index")
                            : route("profile-settings.index")
                    }
                >
                    Settings
                </Link>
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
                <Link href={route("profile-settings.index")}>
                    Profile Settings
                </Link>
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
                            console.log("Toggle dark theme:", checked);
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
                <Link
                    href={route("logout")}
                    method="post"
                    as="button"
                    className="w-full text-left"
                >
                    Logout
                </Link>
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
                theme={user?.dark_theme ? "dark" : "light"}
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
                    theme={user?.dark_theme ? "dark" : "light"}
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
