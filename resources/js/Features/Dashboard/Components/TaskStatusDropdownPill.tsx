import React from "react";
import { Dropdown, MenuProps } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { useTd } from "@/Hooks/useDynamicTranslation";

export interface TaskboardColumn {
    id: number;
    column_name: string;
    slug: string;
    label_color: string;
    priority: number;
}

export const isCompletedColumn = (
    slug: string,
    columns: TaskboardColumn[],
): boolean => {
    const column = columns.find((col) => col.slug === slug);
    return column?.slug === "done";
};

interface TaskStatusDropdownPillProps {
    status: string;
    columns: TaskboardColumn[];
    disabled?: boolean;
    onChange: (slug: string, columnId: number) => void;
}

const TaskStatusDropdownPill: React.FC<TaskStatusDropdownPillProps> = ({
    status,
    columns,
    disabled = false,
    onChange,
}) => {
    const { td } = useTd();

    const sortedColumns = [...columns].sort(
        (a, b) => a.priority - b.priority,
    );
    const currentColumn =
        sortedColumns.find((col) => col.slug === status) ?? sortedColumns[0];
    const currentLabel = currentColumn
        ? td(currentColumn.column_name)
        : td(status.split("_").join(" "));

    const menuItems: MenuProps["items"] = sortedColumns.map((column) => ({
        key: column.slug,
        label: (
            <div className="flex items-center gap-2">
                <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: column.label_color }}
                />
                <span>{td(column.column_name)}</span>
            </div>
        ),
        onClick: () => {
            if (column.slug !== status) {
                onChange(column.slug, column.id);
            }
        },
    }));

    return (
        <Dropdown
            menu={{
                items: menuItems,
                selectable: true,
                selectedKeys: currentColumn ? [currentColumn.slug] : [],
            }}
            trigger={["click"]}
            disabled={disabled || sortedColumns.length === 0}
            placement="bottomLeft"
            overlayClassName="z-[1050]"
        >
            <button
                type="button"
                disabled={disabled}
                className={`inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium capitalize transition-opacity ${
                    disabled
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer hover:opacity-80"
                }`}
                style={{
                    borderColor: currentColumn?.label_color || "#d9d9d9",
                    color: currentColumn?.label_color || "#666",
                    backgroundColor: "white",
                }}
                onClick={(event) => event.stopPropagation()}
            >
                {currentLabel}
                <DownOutlined style={{ fontSize: "10px" }} />
            </button>
        </Dropdown>
    );
};

export default TaskStatusDropdownPill;
