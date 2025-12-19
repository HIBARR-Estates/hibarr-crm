import { Link, router } from "@inertiajs/react";
import type { MenuProps } from "antd";
import {
    HouseIcon,
    PersonIcon,
    BriefcaseIcon,
    HouseDoorIcon,
    // GearIcon,
    CheckSquareIcon,
} from "../Components/icons";


    // Get current path and determine active menu items
    const getCurrentPath = () => {
        if (typeof window !== "undefined") {
            return window.location.pathname;
        }
        return "";
    };

const useDashboardLayoutProps = () => {
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

   

    // Build menu items
    const buildMenuItems = (): MenuProps["items"] => {
        const items: MenuProps["items"] = [
            {
            key: "dashboard",
            label: (
                <Link
                    href={route("dashboard")}
                    onClick={(e) => {
                        e.preventDefault();
                        router.visit(route("dashboard"));
                    }}
                >
                    Dashboard
                </Link>
            ),
            icon: <HouseIcon />,
            disabled: false,
        },
        {
            key: "lead-contact",
            label: (
                <Link
                    href={route("lead-contact.index")}
                    onClick={(e) => {
                        e.preventDefault();
                        router.visit(route("lead-contact.index"));
                    }}
                >
                    Contacts
                </Link>
            ),
            icon: <PersonIcon />,},
            {
            key: "deals",
            label: (
                <Link
                    href={`/account/deals/kanban`}
                    onClick={(e) => {
                        e.preventDefault();
                        router.visit(`/account/deals/kanban`);
                    }}
                >
                    Deals
                </Link>
            ),
            icon: <BriefcaseIcon />,
        },
        {
            key: "tasks",
            label: (
                <Link
                    href={route("tasks.index")}
                    onClick={(e) => {
                        e.preventDefault();
                        router.visit(route("tasks.index"));
                    }}
                >
                    Tasks
                </Link>
            ),
            icon: <CheckSquareIcon />,
        },
        {
            key: "properties",
            label: (
                <Link
                    href={route("properties.index")}
                    onClick={(e) => {
                        e.preventDefault();
                        router.visit(route("properties.index"));
                    }}
                >
                    Properties
                </Link>
            ),
            icon: <HouseDoorIcon />,
        }
        
        ].filter(item => item.disabled !== true);

       



       

     
   


        return items;
    };

  return {
    menuItems: buildMenuItems(),
    activeMenuKeys: getActiveMenuKeys(),
    defaultOpenKeys: getActiveMenuKeys().filter((key) =>
        ["dashboard", "hr", "work", "finance"].includes(key)
    ),
  }
}

export default useDashboardLayoutProps