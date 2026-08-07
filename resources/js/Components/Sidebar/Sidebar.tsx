import React, { useState, useCallback, useEffect } from "react";
import { Link, router, usePage } from "@inertiajs/react";
import { Avatar, Tooltip, Dropdown } from "antd";
import type { MenuProps } from "antd";
import {
    UserOutlined,
    BankOutlined,
    SettingOutlined,
    LogoutOutlined,
    QuestionCircleOutlined,
    BugOutlined,
    BulbOutlined,
    BellOutlined,
    ClockCircleOutlined,
    ApartmentOutlined,
    TeamOutlined,
    HistoryOutlined,
    GiftOutlined,
} from "@ant-design/icons";

import {
    HouseIcon,
    PersonIcon,
    BriefcaseIcon,
    HouseDoorIcon,
    CalendarIcon,
    // GearIcon,
    CheckSquareIcon,
} from "../icons";
import { PageProps } from "../DashboardLayout";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { isPermissionAll } from "@/lib/permissionUtils";

interface Pipeline {
    id: number;
    name: string;
    default: number;
}

interface NavItem {
    key: string;
    label: string;
    icon: React.ReactNode;
    href?: string;
    children?: NavItem[];
    badge?: number;
    hidden?: boolean;
}

interface SidebarProps {
    collapsed: boolean;
    onCollapse: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onCollapse }) => {
    const { props } = usePage<PageProps>();
    const { auth, company, appName } = props;
    const { user } = auth;
    const pipelines = (props.pipelines || []) as Pipeline[];
    const defaultPipeline = pipelines.find((p) => p.default === 1);
    const { t, isRtl } = useTranslation();
    const { td } = useTd();
    const canManageOffers = isPermissionAll(
        props.auth?.permissions?.manage_offers,
    );
    const canManagePartnerNetwork = isPermissionAll(
        props.auth?.permissions?.manage_partner_network,
    );
    const canManageEntityReminders =
        props.auth?.permissions?.manage_company_setting === "all";

    const STORAGE_KEY = "sidebar_expanded_items";

    const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return new Set(parsed);
                }
            }
        } catch {
            // ignore parse errors
        }
        return new Set(["deals"]);
    });

    // Persist expanded state to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify([...expandedItems]),
            );
        } catch {
            // ignore storage errors
        }
    }, [expandedItems]);

    // Get current path and search params for active state
    const getCurrentUrl = useCallback(() => {
        if (typeof window !== "undefined") {
            return {
                pathname: window.location.pathname,
                search: window.location.search,
            };
        }
        return { pathname: "", search: "" };
    }, []);

    const { pathname: currentPath, search: currentSearch } = getCurrentUrl();

    // Check if a nav item is active
    const isActive = useCallback(
        (item: NavItem): boolean => {
            if (item.href) {
                const [itemPath, itemQuery] = item.href.split("?");
                const pathMatches = currentPath.includes(itemPath);

                // If the item has a query string, we need to match it exactly
                if (itemQuery) {
                    const itemParams = new URLSearchParams(itemQuery);
                    const currentParams = new URLSearchParams(currentSearch);

                    // Check if all item params are present in current URL
                    let allParamsMatch = true;
                    itemParams.forEach((value, key) => {
                        if (currentParams.get(key) !== value) {
                            allParamsMatch = false;
                        }
                    });

                    return pathMatches && allParamsMatch;
                }

                // For items without query params, just check if path matches
                // but make sure it's not a parent route that matches children
                return pathMatches && !item.children;
            }
            // For parent items with children, check if any child is active
            if (item.children) {
                return item.children.some((child) => isActive(child));
            }
            return false;
        },
        [currentPath, currentSearch],
    );

    // Toggle expanded state for items with children (accordion: only one open at a time)
    const toggleExpanded = useCallback((key: string) => {
        setExpandedItems((prev) => {
            if (prev.has(key)) {
                // Collapsing the currently open item
                return new Set();
            }
            // Opening a new item — close all others (accordion)
            return new Set([key]);
        });
    }, []);

    // Navigation items
    const navItems: NavItem[] = [
        {
            key: "dashboard",
            label: t("app.menu.dashboard"),
            icon: <HouseIcon />,
            href: "/account/dashboard",
        },
        {
            key: "leads",
            label: t("app.menu.lead"),
            icon: <PersonIcon />,
            href: "/account/lead-contact",
        },
        // {
        //     key: "agents",
        //     label: "Agents",
        //     icon: <TeamOutlined />,
        //     href: "/account/agents",
        // },
        {
            key: "deals",
            label: t("app.menu.deal"),
            icon: <BriefcaseIcon />,
            children:
                pipelines.length > 0
                    ? pipelines.map((pipeline) => ({
                          key: `deals-${pipeline.id}`,
                          label: td(pipeline.name),
                          icon: null,
                          href: `/account/deals?lead_pipeline_id=${pipeline.id}`,
                      }))
                    : [
                          {
                              key: "deals-all",
                              label: t("app.menu.allDeals"),
                              icon: null,
                              href: `/account/deals${
                                  defaultPipeline
                                      ? `?lead_pipeline_id=${defaultPipeline.id}`
                                      : ""
                              }`,
                          },
                      ],
        },
        {
            key: "offers",
            label: t("app.menu.offers"),
            icon: <GiftOutlined />,
            href: "/account/offers",
            hidden: !canManageOffers,
        },
        {
            key: "meetings",
            label: t("app.menu.meetings"),
            icon: <CalendarIcon />,
            href: "/account/meetings",
        },
        {
            key: "tasks",
            label: t("app.menu.tasks"),
            icon: <CheckSquareIcon />,
            href: "/account/tasks",
        },
        {
            key: "properties",
            label: t("app.menu.properties"),
            icon: <HouseDoorIcon />,
            href: "/account/properties?page=1&per_page=16&sort_by=&sort_direction=asc",
        },
        // {
        //     key: "crm-events",
        //     label: "CRM Events",
        //     icon: <HistoryOutlined />,
        //     href: "/account/crm-events",
        // },
        {
            key: "developers",
            label: t("app.menu.projects"),
            icon: <BankOutlined />,
            href: "/account/developer-projects",
        },
        {
            key: "reports",
            label: t("app.menu.reports"),
            icon: <HistoryOutlined />,
            href: "/account/agent-reports",
        },
        {
            key: "mlm",
            label: t("app.menu.partner_network"),
            icon: <ApartmentOutlined />,
            children: [
                {
                    key: "mlm-dashboard",
                    label: t("app.menu.mlm.dashboard"),
                    icon: null,
                    href: "/account/mlm/dashboard",
                },
                {
                    key: "mlm-levels",
                    label: t("app.menu.mlm.levels"),
                    icon: null,
                    href: "/account/mlm/levels",
                },
                {
                    key: "mlm-commission-settings",
                    label: t("app.menu.mlm.commission_settings"),
                    icon: null,
                    href: "/account/mlm/commission-settings",
                },
                {
                    key: "mlm-cycle-management",
                    label: t("app.menu.mlm.cycle_management"),
                    icon: null,
                    href: "/account/mlm/cycle-management",
                },
                {
                    key: "mlm-hierarchy",
                    label: t("app.menu.mlm.agent_hierarchy"),
                    icon: null,
                    href: "/account/mlm/agent-hierarchy",
                },
                {
                    key: "mlm-ledger",
                    label: t("app.menu.mlm.commission_ledger"),
                    icon: null,
                    href: "/account/mlm/commission-ledger",
                },
                {
                    key: "mlm-metrics",
                    label: t("app.menu.mlm.agent_metrics"),
                    icon: null,
                    href: "/account/mlm/agent-metrics",
                },
                {
                    key: "mlm-history",
                    label: t("app.menu.mlm.level_history"),
                    icon: null,
                    href: "/account/mlm/level-history",
                },
            ],
            hidden: !canManagePartnerNetwork,
        },
        {
            key: "my-mlm",
            label: t("app.menu.affiliate_workspace"),
            icon: <TeamOutlined />,
            children: [
                {
                    key: "my-mlm-dashboard",
                    label: t("app.mlm.agent.dashboard"),
                    icon: null,
                    href: "/account/mlm/agent/dashboard",
                },
                {
                    key: "my-mlm-commissions",
                    label: t("app.mlm.agent.commissions"),
                    icon: null,
                    href: "/account/mlm/agent/commissions",
                },
                {
                    key: "my-mlm-network",
                    label: t("app.mlm.agent.network"),
                    icon: null,
                    href: "/account/mlm/agent/network",
                },
                // {
                //     key: "my-mlm-uplines",
                //     label: "My Uplines",
                //     icon: null,
                //     href: "/account/mlm/agent/uplines",
                // },
                // {
                //     key: "my-mlm-level",
                //     label: "My Level",
                //     icon: null,
                //     href: "/account/mlm/agent/my-level",
                // },
                // {
                //     key: "my-mlm-deals",
                //     label: "My Deals",
                //     icon: null,
                //     href: "/account/mlm/agent/deal-contributions",
                // },
            ],
        },
    ];

    // User dropdown menu items
    const userMenuItems: MenuProps["items"] = [
        {
            key: "settings",
            icon: <SettingOutlined />,
            label: t("app.menu.settings"),
            onClick: () => router.visit("/account/settings/profile"),
        },
        {
            key: "reminder-preferences",
            icon: <BellOutlined />,
            label: t("app.menu.settings_menu.reminder_preferences"),
            onClick: () =>
                router.visit("/account/settings/reminder-preferences/manage"),
        },
        ...(canManageEntityReminders
            ? [
                  {
                      key: "entity-reminder-defaults",
                      icon: <ClockCircleOutlined />,
                      label: t("app.menu.settings_menu.entity_reminder_defaults"),
                      onClick: () =>
                          router.visit(
                              "/account/settings/entity-reminder-defaults",
                          ),
                  },
                  {
                      key: "reminder-ledger",
                      icon: <BellOutlined />,
                      label: t("app.menu.settings_menu.reminder_ledger"),
                      onClick: () =>
                          router.visit("/account/settings/reminder-ledger"),
                  },
              ]
            : []),
        {
            type: "divider",
        },
        {
            key: "logout",
            icon: <LogoutOutlined />,
            label: t("app.logout"),
            danger: true,
            onClick: () => router.post("/logout"),
        },
    ];

    // Support dropdown menu items
    const supportMenuItems: MenuProps["items"] = [
        {
            key: "bugs",
            icon: <BugOutlined />,
            label: (
                <a
                    href="https://hibarr-dev.atlassian.net/jira/software/form/04cb685a-c280-4a27-a1d4-b708de106630?from=directory"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {t("app.reportBugs")}
                </a>
            ),
        },
        {
            key: "features",
            icon: <BulbOutlined />,
            label: (
                <a
                    href="https://hibarr-dev.atlassian.net/jira/software/form/474174e9-559d-46bb-a504-d7df04eef2af?from=directory"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {t("app.requestFeatures")}
                </a>
            ),
        },
    ];

    // Navigate to a link
    const handleNavigate = useCallback((href: string, e?: React.MouseEvent) => {
        e?.preventDefault();
        router.visit(href);
    }, []);

    // Render a navigation item
    const renderNavItem = useCallback(
        (item: NavItem, depth: number = 0) => {
            const hasChildren = item.children && item.children.length > 0;
            const isItemActive = isActive(item);
            const isExpanded = expandedItems.has(item.key);

            const itemContent = (
                <div
                    className={`
                        group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer
                        transition-all duration-200 ease-out
                        ${depth > 0 ? "ml-4 pl-4" : ""}
                        ${
                            isItemActive
                                ? "bg-[#1890ff] text-white shadow-lg shadow-blue-500/25"
                                : "text-slate-300 hover:bg-[#1890ff50] hover:text-white"
                        }
                    `}
                    onClick={(e) => {
                        if (hasChildren) {
                            toggleExpanded(item.key);
                        } else if (item.href) {
                            handleNavigate(item.href, e);
                        }
                    }}
                >
                    {/* Icon */}
                    {item.icon && (
                        <span
                            className={`
                                flex items-center justify-center w-5 h-5 text-lg
                                transition-colors duration-200
                                ${
                                    isItemActive
                                        ? "text-white"
                                        : "text-slate-400 group-hover:text-white"
                                }
                            `}
                        >
                            {item.icon}
                        </span>
                    )}

                    {/* Label */}
                    {!collapsed && (
                        <>
                            <span className="flex-1 text-sm font-medium truncate">
                                {item.label}
                            </span>

                            {/* Badge */}
                            {item.badge && (
                                <span className="px-2 py-0.5 text-xs font-semibold bg-blue-500 text-white rounded-full">
                                    {item.badge}
                                </span>
                            )}

                            {/* Expand/Collapse indicator */}
                            {hasChildren && (
                                <svg
                                    className={`w-4 h-4 transition-transform duration-200 ${
                                        isExpanded ? "rotate-180" : ""
                                    }`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                    />
                                </svg>
                            )}
                        </>
                    )}
                </div>
            );

            // Wrap in tooltip when collapsed
            const wrappedContent = collapsed ? (
                <Tooltip title={item.label} placement="right">
                    {itemContent}
                </Tooltip>
            ) : (
                itemContent
            );

            return (
                <a key={item.key} className="mb-1" href={item?.href}>
                    {wrappedContent}

                    {/* Children */}
                    {hasChildren && !collapsed && (
                        <div
                            className={`
                                overflow-hidden transition-all duration-300 ease-out
                                ${
                                    isExpanded
                                        ? "max-h-96 opacity-100 mt-1"
                                        : "max-h-0 opacity-0"
                                }
                            `}
                        >
                            <div className="border-l-2 border-slate-700 ml-5">
                                {item.children!.map((child) =>
                                    renderNavItem(child, depth + 1),
                                )}
                            </div>
                        </div>
                    )}
                </a>
            );
        },
        [collapsed, expandedItems, isActive, toggleExpanded, handleNavigate],
    );

    return (
        <aside
            className={`
                fixed top-0 h-screen z-40
                flex flex-col
                bg-[#001529]
                transition-all duration-300 ease-out
                ${isRtl ? "right-0 border-l border-slate-700/50" : "left-0 border-r border-slate-700/50"}
                ${collapsed ? "w-[72px]" : "w-[260px]"}
            `}
        >
            {/* Header / Brand */}
            <div
                className={`
                    flex items-center h-16 border-b border-slate-700/50
                    ${collapsed ? "justify-center px-4" : "justify-center px-3"}
                `}
            >
                {!collapsed && company?.logo_url ? (
                    <img
                        src={company.logo_url}
                        alt={appName}
                        className="h-10 w-full max-w-full object-contain"
                    />
                ) : (
                    <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-lg">
                            {appName?.charAt(0) || "H"}
                        </span>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {/* Section label */}
                {/* {!collapsed && (
                    <div className="px-3 mb-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Main Menu
                        </span>
                    </div>
                )} */}

                {/* Nav items */}
                {navItems
                    .filter((a) => a.hidden !== true)
                    .map((a) => {
                        a.children = a.children?.filter(
                            (a) => a.hidden !== true,
                        );
                        return a;
                    })
                    .map((item) => renderNavItem(item))}
            </nav>

            {/* Footer */}
            <div className="border-t border-slate-700/50 p-3">
                {/* Support button */}
                <Dropdown
                    menu={{ items: supportMenuItems }}
                    placement="topRight"
                    trigger={["click"]}
                >
                    <div
                        className={`
                            flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer mb-2
                            text-slate-300 hover:bg-slate-700/50 hover:text-white
                            transition-all duration-200
                            ${collapsed ? "justify-center" : ""}
                        `}
                    >
                        <QuestionCircleOutlined className="text-lg text-slate-400" />
                        {!collapsed && (
                            <span className="text-sm font-medium">
                                {t("app.support")}
                            </span>
                        )}
                    </div>
                </Dropdown>

                {/* Collapse toggle button - always at bottom */}
                <button
                    onClick={() => onCollapse(!collapsed)}
                    className={`
                        flex items-center gap-3 w-full px-3 py-2.5 rounded-lg
                        text-slate-300 hover:bg-slate-700/50 hover:text-white
                        transition-all duration-200
                        ${collapsed ? "justify-center" : ""}
                    `}
                >
                    <svg
                        className={`w-5 h-5 transition-transform duration-200 ${
                            collapsed ? "rotate-180" : ""
                        } ${isRtl ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 19l-7-7 7-7"
                        />
                    </svg>
                    {!collapsed && (
                        <span className="text-sm font-medium">
                            {t("app.collapse")}
                        </span>
                    )}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
