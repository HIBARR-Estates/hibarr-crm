import { Link, router, usePage } from "@inertiajs/react";
import type { MenuProps } from "antd";
import {
    HouseIcon,
    PersonIcon,
    BriefcaseIcon,
    HouseDoorIcon,
    // GearIcon,
    CheckSquareIcon,
} from "../Components/icons";
import { BuildingIcon } from "../Components/icons";

// Get current path and determine active menu items
const getCurrentPath = () => {
    if (typeof window !== "undefined") {
        return window.location.pathname;
    }
    return "";
};

interface Pipeline {
    id: number;
    name: string;
    default: number;
}

const useDashboardLayoutProps = () => {
    const { props } = usePage();
    const pipelines = (props.pipelines || []) as Pipeline[];
    const defaultPipeline = pipelines.find((p) => p.default === 1);

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

            // Also add the specific pipeline key for submenu highlighting
            if (typeof window !== "undefined") {
                const urlParams = new URLSearchParams(window.location.search);
                const pipelineId = urlParams.get("lead_pipeline_id");
                if (pipelineId) {
                    activeKeys.push(`deals-pipeline-${pipelineId}`);
                } else if (defaultPipeline) {
                    // If no pipeline in URL, use default pipeline
                    activeKeys.push(`deals-pipeline-${defaultPipeline.id}`);
                }
            }
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

        // Check developer projects routes
        if (currentPath.includes("/developer-projects")) {
            activeKeys.push("developer-projects");
        }

        // Check project locations routes
        if (currentPath.includes("/project-locations")) {
            activeKeys.push("project-locations");
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
                        Leads
                    </Link>
                ),
                icon: <PersonIcon />,
            },
            {
                key: "deals",
                label:
                    pipelines.length > 0 ? (
                        "Deals"
                    ) : (
                        <Link
                            href={`/account/deals${
                                defaultPipeline
                                    ? `?lead_pipeline_id=${defaultPipeline.id}`
                                    : ""
                            }`}
                            onClick={(e) => {
                                e.preventDefault();
                                router.visit(
                                    `/account/deals${
                                        defaultPipeline
                                            ? `?lead_pipeline_id=${defaultPipeline.id}`
                                            : ""
                                    }`,
                                );
                            }}
                        >
                            Deals
                        </Link>
                    ),
                icon: <BriefcaseIcon />,
                children:
                    pipelines.length > 0
                        ? pipelines.map((pipeline) => ({
                              key: `deals-pipeline-${pipeline.id}`,
                              label: (
                                  <Link
                                      href={`/account/deals?lead_pipeline_id=${pipeline.id}`}
                                      onClick={(e) => {
                                          e.preventDefault();
                                          router.visit(
                                              `/account/deals?lead_pipeline_id=${pipeline.id}`,
                                          );
                                      }}
                                  >
                                      {pipeline.name}
                                  </Link>
                              ),
                          }))
                        : undefined,
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
            },
            {
                key: "developer-projects",
                label: (
                    <Link
                        href={route("developer-projects.index")}
                        onClick={(e) => {
                            e.preventDefault();
                            router.visit(route("developer-projects.index"));
                        }}
                    >
                        Developer Projects
                    </Link>
                ),
                icon: <BuildingIcon />,
            },
        ].filter((item) => item.disabled !== true);

        return items;
    };

    return {
        menuItems: buildMenuItems(),
        activeMenuKeys: getActiveMenuKeys(),
        defaultOpenKeys: getActiveMenuKeys().filter((key) =>
            ["dashboard", "hr", "work", "finance", "deals"].includes(key),
        ),
    };
};

export default useDashboardLayoutProps;
