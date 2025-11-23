import { Link, usePage } from "@inertiajs/react";
import { Button } from "antd";
import { TableOutlined, AppstoreOutlined } from "@ant-design/icons";

const DealsModeSwitcher = () => {
    const { url } = usePage();

    // Check if current page is kanban board view
    const isKanbanView =
        url.includes("/leadboards") || url.includes("/deals/kanban");

    // Check if current page is table view
    const isTableView =
        url.includes("/deals") && !url.includes("/deals/kanban");

    return (
        <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-md p-1">
                <Link href={`/account/deals/kanban`}>
                    <Button
                        type="text"
                        icon={<AppstoreOutlined />}
                        className={`${
                            isKanbanView
                                ? "!bg-white !shadow-sm"
                                : "hover:bg-white hover:shadow-sm"
                        }`}
                        title="Kanban Board"
                    />
                </Link>
                <Link href={route("deals.index")}>
                    <Button
                        type="text"
                        icon={<TableOutlined />}
                        className={`${
                            isTableView
                                ? "!bg-white !shadow-sm"
                                : "hover:bg-white hover:shadow-sm"
                        }`}
                        title="Table View"
                    />
                </Link>
            </div>
        </div>
    );
};

export default DealsModeSwitcher;
