import React from "react";
import { Button } from "antd";
import { TableOutlined, AppstoreOutlined } from "@ant-design/icons";
import { router, usePage } from "@inertiajs/react";

interface DealsModeSwitcherProps {
    view?: "kanban" | "table";
    onChange?: (view: "kanban" | "table") => void;
}

/**
 * DealsModeSwitcher - Toggles between kanban and table view
 *
 * Can be used in two modes:
 * 1. Controlled mode: Pass view and onChange props for local state management
 * 2. Uncontrolled mode: No props, uses URL-based navigation (legacy support)
 */
const DealsModeSwitcher: React.FC<DealsModeSwitcherProps> = ({
    view,
    onChange,
}) => {
    const { url } = usePage();

    // Controlled mode - use props
    if (view !== undefined && onChange !== undefined) {
        const isKanbanView = view === "kanban";
        const isTableView = view === "table";

        return (
            <div className="flex items-center gap-2">
                <div className="flex bg-gray-100 rounded-md p-1">
                    <Button
                        type="text"
                        icon={<AppstoreOutlined />}
                        className={`${
                            isKanbanView
                                ? "!bg-white !shadow-sm"
                                : "hover:bg-white hover:shadow-sm"
                        }`}
                        title="Kanban Board"
                        onClick={() => onChange("kanban")}
                    />
                    <Button
                        type="text"
                        icon={<TableOutlined />}
                        className={`${
                            isTableView
                                ? "!bg-white !shadow-sm"
                                : "hover:bg-white hover:shadow-sm"
                        }`}
                        title="Table View"
                        onClick={() => onChange("table")}
                    />
                </div>
            </div>
        );
    }

    // Uncontrolled mode - URL-based navigation (legacy)
    const isKanbanView =
        url.includes("/leadboards") || url.includes("/deals/kanban");
    const isTableView =
        url.includes("/deals") && !url.includes("/deals/kanban");

    // Preserve current URL params when switching views
    const urlParams =
        typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).toString()
            : "";
    const queryString = urlParams ? `?${urlParams}` : "";

    return (
        <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-md p-1">
                <Button
                    type="text"
                    icon={<AppstoreOutlined />}
                    className={`${
                        isKanbanView
                            ? "!bg-white !shadow-sm"
                            : "hover:bg-white hover:shadow-sm"
                    }`}
                    title="Kanban Board"
                    onClick={() =>
                        router.visit(`/account/deals/kanban${queryString}`)
                    }
                />
                <Button
                    type="text"
                    icon={<TableOutlined />}
                    className={`${
                        isTableView
                            ? "!bg-white !shadow-sm"
                            : "hover:bg-white hover:shadow-sm"
                    }`}
                    title="Table View"
                    onClick={() =>
                        router.visit(route("deals.index") + queryString)
                    }
                />
            </div>
        </div>
    );
};

export default DealsModeSwitcher;
