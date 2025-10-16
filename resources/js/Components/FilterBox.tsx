import React from "react";
import { Button, Input } from "antd";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";

const { Search } = Input;

interface FilterBoxProps {
    children: React.ReactNode;
    onReset?: () => void;
    showReset?: boolean;
}

export default function FilterBox({
    children,
    onReset,
    showReset = false,
}: FilterBoxProps) {
    return (
        <form>
            <div className="flex flex-wrap items-center bg-white px-4 border-b border-gray-200 gap-2">
                {children}

                {/* Reset Filters */}
                {showReset && onReset && (
                    <div className="flex items-center py-2 px-3">
                        <Button
                            size="middle"
                            icon={<ReloadOutlined />}
                            onClick={onReset}
                            type="default"
                            className="border-gray-300"
                        >
                            Clear Filters
                        </Button>
                    </div>
                )}
            </div>
        </form>
    );
}

interface FilterItemProps {
    label: string;
    children: React.ReactNode;
    className?: string;
}

export function FilterItem({
    label,
    children,
    className = "",
}: FilterItemProps) {
    return (
        <div
            className={`flex items-center py-2 px-3 border-r border-gray-200 ${className}`}
        >
            <p className="mb-0 pr-3 text-sm text-gray-600 flex items-center whitespace-nowrap font-medium">
                {label}:
            </p>
            <div className="min-w-0">{children}</div>
        </div>
    );
}

interface SearchFilterProps {
    placeholder?: string;
    value?: string;
    onChange?: (value: string) => void;
    onSearch?: (value: string) => void;
}

export function SearchFilter({
    placeholder = "Start typing...",
    value,
    onChange,
    onSearch,
}: SearchFilterProps) {
    return (
        <div className="flex items-center py-1 px-3 border-r border-gray-200">
            <div className="w-full min-w-0 mx-1">
                <Search
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange?.(e.target.value)}
                    onSearch={onSearch}
                    style={{ minWidth: "250px" }}
                    size="middle"
                    allowClear
                />
            </div>
        </div>
    );
}
