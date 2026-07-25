import React from "react";
import { Dropdown, MenuProps } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { useTd } from "@/Hooks/useDynamicTranslation";

const darkenHex = (hex: string, factor = 0.75): string => {
    const h = hex.replace("#", "");
    const r = Math.round(parseInt(h.slice(0, 2), 16) * factor);
    const g = Math.round(parseInt(h.slice(2, 4), 16) * factor);
    const b = Math.round(parseInt(h.slice(4, 6), 16) * factor);
    return `rgb(${r},${g},${b})`;
};

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
    /** Shows a spinner in place of the chevron while a status change is saving. */
    loading?: boolean;
    onChange: (slug: string, columnId: number) => void;
}

const TaskStatusDropdownPill: React.FC<TaskStatusDropdownPillProps> = ({
    status,
    columns,
    disabled = false,
    loading = false,
    onChange,
}) => {
    const { td } = useTd();

    const sortedColumns = [...columns].sort(
        (a, b) => a.priority - b.priority,
    );
    const currentColumn =
        sortedColumns.find((col) => col.slug === status) ?? sortedColumns[0];
    const currentLabel = currentColumn
        ? td(currentColumn.column_name).toLowerCase()
        : td(status.split("_").join(" ")).toLowerCase();

    const menuItems: MenuProps["items"] = sortedColumns.map((column) => ({
        key: column.slug,
        label: (
            <div className="flex items-center gap-2">
                <span
                    aria-hidden="true"
                    style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        flexShrink: 0,
                        backgroundColor: column.label_color,
                    }}
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
            disabled={disabled || loading || sortedColumns.length === 0}
            placement="bottomLeft"
            overlayClassName="z-[1050]"
        >
            <button
                type="button"
                disabled={disabled || loading}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-opacity ${
                    disabled
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer hover:opacity-80"
                }`}
                style={{
                    backgroundColor: `${currentColumn?.label_color || "#999"}0d`,
                    color: currentColumn?.label_color ? darkenHex(currentColumn.label_color) : "#555",
                    borderColor: currentColumn?.label_color || "#999",
                    borderWidth: "1px",
                    borderStyle: "solid",
                }}
                onClick={(event) => event.stopPropagation()}
            >
                <span
                    aria-hidden="true"
                    style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        flexShrink: 0,
                        backgroundColor: currentColumn?.label_color || "#999",
                    }}
                />
                {currentLabel}
                {loading ? (
                    <span
                        aria-hidden="true"
                        className="animate-spin rounded-full border-2 border-solid border-current border-t-transparent"
                        style={{ width: 9, height: 9 }}
                    />
                ) : (
                    <DownOutlined style={{ fontSize: "9px", opacity: 0.7 }} />
                )}
            </button>
        </Dropdown>
    );
};

export default TaskStatusDropdownPill;
