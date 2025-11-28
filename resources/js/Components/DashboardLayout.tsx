import React, { useState } from "react";
import { usePage } from "@inertiajs/react";
import { Layout, Menu, Image, theme } from "antd";
import type { MenuProps } from "antd";
import {
    HouseIcon,
    PersonIcon,
    BriefcaseIcon,
    HouseDoorIcon,
    CheckSquareIcon,
} from "./icons";
import { PageProps as InertiaPageProps, router } from "@inertiajs/core";
import { AuthType } from "@/Types";

const { Content, Sider } = Layout;

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

    // Get current path and determine active menu items
    const getCurrentPath = () => {
        if (typeof window !== "undefined") {
            return window.location.pathname;
        }
        return "";
    };

    const isPathActive = (routePath: string): boolean => {
        const currentPath = getCurrentPath();
        // Handle exact matches and path prefixes
        return (
            currentPath === routePath || currentPath.startsWith(routePath + "/")
        );
    };

    const getActiveMenuKeys = (): string[] => {
        const currentPath = getCurrentPath();
        const activeKeys: string[] = [];

        // Check dashboard routes
        if (currentPath === "/" || currentPath.includes("/dashboard")) {
            activeKeys.push("dashboard");
            if (currentPath.includes("/advanced")) {
                activeKeys.push("advanced-dashboard");
            } else {
                activeKeys.push("private-dashboard");
            }
        }

        // Check calendar routes
        if (currentPath.includes("/my-calendar")) {
            activeKeys.push("my-calendar");
        }

        // Check leads routes
        if (currentPath.includes("/lead-contact")) {
            activeKeys.push("lead-contact");
        }
        if (
            currentPath.includes("/deals") ||
            currentPath.includes("/leadboards")
        ) {
            activeKeys.push("deals");
        }

        // Check clients routes
        if (currentPath.includes("/clients")) {
            activeKeys.push("clients");
        }

        // Check HR routes
        if (currentPath.includes("/employees")) {
            activeKeys.push("hr", "employees");
        }
        if (currentPath.includes("/leaves")) {
            activeKeys.push("hr", "leaves");
        }
        if (currentPath.includes("/attendances")) {
            activeKeys.push("hr", "attendance");
        }
        if (currentPath.includes("/holidays")) {
            activeKeys.push("hr", "holidays");
        }

        // Check work routes
        if (currentPath.includes("/contracts")) {
            activeKeys.push("work", "contracts");
        }
        if (currentPath.includes("/projects")) {
            activeKeys.push("work", "projects");
        }
        if (currentPath.includes("/tasks")) {
            activeKeys.push("tasks");
        }
        if (currentPath.includes("/timelogs")) {
            activeKeys.push("work", "timelogs");
        }

        // Check finance routes
        if (currentPath.includes("/estimates")) {
            activeKeys.push("finance", "estimates");
        }
        if (currentPath.includes("/invoices")) {
            activeKeys.push("finance", "invoices");
        }
        if (currentPath.includes("/payments")) {
            activeKeys.push("finance", "payments");
        }

        // Check products routes
        if (currentPath.includes("/products")) {
            activeKeys.push("products");
        }

        // Check properties routes
        if (currentPath.includes("/properties")) {
            activeKeys.push("properties");
        }

        // Check settings routes
        if (currentPath.includes("/settings")) {
            activeKeys.push("settings");
        }

        return activeKeys;
    };

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
        items.push({
            key: "dashboard",
            label: (
                <a
                    href={route("dashboard")}
                    onClick={(e) => {
                        e.preventDefault();
                        router.visit(route("dashboard"));
                    }}
                >
                    Dashboard
                </a>
            ),
            icon: <HouseIcon />,
        });

        // My Calendar
        // if (
        //     hasModule("tasks") ||
        //     hasModule("events") ||
        //     hasModule("holidays") ||
        //     hasModule("tickets") ||
        //     hasModule("leaves")
        // ) {
        //     items.push({
        //         key: "my-calendar",
        //         label: (
        //             <span
        //                 onClick={() => router.visit(route("my-calendar.index"))}
        //                 className="cursor-pointer"
        //             >
        //                 My Calendar
        //             </span>
        //         ),
        //         icon: <CalendarIcon />,
        //     });
        // }

        // Leads
        items.push({
            key: "lead-contact",
            label: (
                <a
                    href={route("lead-contact.index")}
                    onClick={(e) => {
                        e.preventDefault();
                        router.visit(route("lead-contact.index"));
                    }}
                >
                    Contacts
                </a>
            ),
            icon: <PersonIcon />,
        });

        items.push({
            key: "deals",
            label: (
                <a
                    href={`/account/deals/kanban`}
                    onClick={(e) => {
                        e.preventDefault();
                        router.visit(`/account/deals/kanban`);
                    }}
                >
                    Deals
                </a>
            ),
            icon: <BriefcaseIcon />,
        });

        // Tasks
        items.push({
            key: "tasks",
            label: (
                <a
                    href={route("tasks.index")}
                    onClick={(e) => {
                        e.preventDefault();
                        router.visit(route("tasks.index"));
                    }}
                >
                    Tasks
                </a>
            ),
            icon: <CheckSquareIcon />,
        });

        // Clients
        // if (
        //     !isInRole("client") &&
        //     hasModule("clients") &&
        //     hasPermission("view_clients")
        // ) {
        //     items.push({
        //         key: "clients",
        //         label: (
        //             <a
        //                 href={route("clients.index")}
        //                 onClick={(e) => {
        //                     e.preventDefault();
        //                     router.visit(route("clients.index"));
        //                 }}
        //             >
        //                 Clients
        //             </a>
        //         ),
        //         icon: <BuildingIcon />,
        //     });
        // }

        // HR
        // if (
        //     !isInRole("client") &&
        //     (hasModule("employees") ||
        //         hasModule("leaves") ||
        //         hasModule("attendance") ||
        //         hasModule("holidays")) &&
        //     (hasPermission("view_employees") ||
        //         hasPermission("view_leave") ||
        //         hasPermission("view_attendance") ||
        //         hasPermission("view_holiday"))
        // ) {
        //     const hrChildren: MenuProps["items"] = [];

        //     if (hasModule("employees") && hasPermission("view_employees")) {
        //         hrChildren.push({
        //             key: "employees",
        //             label: <a href={route("employees.index")}>Employees</a>,
        //         });
        //     }

        //     if (hasModule("leaves") && hasPermission("view_leave")) {
        //         hrChildren.push({
        //             key: "leaves",
        //             label: <a href={route("leaves.index")}>Leaves</a>,
        //         });
        //     }

        //     if (hasModule("attendance") && hasPermission("view_attendance")) {
        //         hrChildren.push({
        //             key: "attendance",
        //             label: <a href={route("attendances.index")}>Attendance</a>,
        //         });
        //     }

        //     if (hasModule("holidays") && hasPermission("view_holiday")) {
        //         hrChildren.push({
        //             key: "holidays",
        //             label: <a href={route("holidays.index")}>Holidays</a>,
        //         });
        //     }

        //     items.push({
        //         key: "hr",
        //         label: "HR",
        //         icon: <PeopleIcon />,
        //         children: hrChildren,
        //     });
        // }

        // Work
        // if (
        //     (hasModule("contracts") ||
        //         hasModule("projects") ||
        //         hasModule("tasks") ||
        //         hasModule("timelogs")) &&
        //     (hasPermission("view_contract") ||
        //         hasPermission("view_projects") ||
        //         hasPermission("view_tasks") ||
        //         hasPermission("view_timelogs"))
        // ) {
        //     const workChildren: MenuProps["items"] = [];

        //     if (hasModule("contracts") && hasPermission("view_contract")) {
        //         workChildren.push({
        //             key: "contracts",
        //             label: <a href={route("contracts.index")}>Contracts</a>,
        //         });
        //     }

        //     if (hasModule("projects") && hasPermission("view_projects")) {
        //         workChildren.push({
        //             key: "projects",
        //             label: <a href={route("projects.index")}>Projects</a>,
        //         });
        //     }

        //     if (hasModule("tasks") && hasPermission("view_tasks")) {
        //         workChildren.push({
        //             key: "tasks",
        //             label: <a href={route("tasks.index")}>Tasks</a>,
        //         });
        //     }

        //     if (hasModule("timelogs") && hasPermission("view_timelogs")) {
        //         workChildren.push({
        //             key: "timelogs",
        //             label: <a href={route("timelogs.index")}>Time Logs</a>,
        //         });
        //     }

        //     items.push({
        //         key: "work",
        //         label: "Work",
        //         icon: <BriefcaseIcon />,
        //         children: workChildren,
        //     });
        // }

        // Finance
        // if (
        //     (hasModule("estimates") ||
        //         hasModule("invoices") ||
        //         hasModule("payments") ||
        //         hasModule("expenses") ||
        //         hasModule("bankaccount")) &&
        //     (hasPermission("view_estimates") ||
        //         hasPermission("view_invoices") ||
        //         hasPermission("view_payments") ||
        //         hasPermission("view_expenses") ||
        //         hasPermission("view_bankaccount"))
        // ) {
        //     const financeChildren: MenuProps["items"] = [];

        //     if (hasModule("estimates") && hasPermission("view_estimates")) {
        //         financeChildren.push({
        //             key: "estimates",
        //             label: <a href={route("estimates.index")}>Estimates</a>,
        //         });
        //     }

        //     if (hasModule("invoices") && hasPermission("view_invoices")) {
        //         financeChildren.push({
        //             key: "invoices",
        //             label: <a href={route("invoices.index")}>Invoices</a>,
        //         });
        //     }

        //     if (hasModule("payments") && hasPermission("view_payments")) {
        //         financeChildren.push({
        //             key: "payments",
        //             label: <a href={route("payments.index")}>Payments</a>,
        //         });
        //     }

        //     items.push({
        //         key: "finance",
        //         label: "Finance",
        //         icon: <CashCoinIcon />,
        //         children: financeChildren,
        //     });
        // }

        // Products
        // if (hasModule("products") && hasPermission("view_product")) {
        //     items.push({
        //         key: "products",
        //         label: <a href={route("products.index")}>Products</a>,
        //         icon: <BasketIcon />,
        //     });
        // }

        // Properties
        items.push({
            key: "properties",
            label: (
                <a
                    href={route("properties.index")}
                    onClick={(e) => {
                        e.preventDefault();
                        router.visit(route("properties.index"));
                    }}
                >
                    Properties
                </a>
            ),
            icon: <HouseDoorIcon />,
        });

        return items;
    };

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
                <div className="px-4 flex items-center justify-center bg-white h-[69px]">
                    <Image src={company?.logo_url} alt={appName} preview={false} />
                </div>

                {/* Navigation Menu */}
                <Menu
                    // theme={user?.dark_theme ? "dark" : "light"}
                    // TODO: Update once work is finished on the dashboard layout
                    theme={"dark"}
                    mode="inline"
                    selectedKeys={getActiveMenuKeys()}
                    defaultOpenKeys={getActiveMenuKeys().filter((key) =>
                        ["dashboard", "hr", "work", "finance"].includes(key)
                    )}
                    items={buildMenuItems()}
                    className="border-none"
                    style={{ padding: "12px 8px" }}
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
