import React from "react";
import { Drawer, Button, Space, Divider, Typography } from "antd";
import { FilterOutlined, ReloadOutlined } from "@ant-design/icons";
import { TFilter } from "@/Types/common";

const { Title } = Typography;

interface FilterDrawerProps {
    /**
     * Whether the drawer is open
     */
    open: boolean;

    /**
     * Function to close the drawer
     */
    onClose: () => void;

    /**
     * Title of the drawer
     */
    title: string;

    /**
     * Current filter values
     */
    filters: TFilter;

    /**
     * Function to handle filter submission
     */
    onApplyFilters: (filters: TFilter) => void;

    /**
     * Function to reset all filters
     */
    onResetFilters: () => void;

    /**
     * The filter form content to render inside the drawer
     */
    children: React.ReactNode;

    /**
     * Width of the drawer
     */
    width?: number | string;

    /**
     * Whether filters can be reset
     */
    canReset?: boolean;

    /**
     * Loading state for apply button
     */
    loading?: boolean;
}

const FilterDrawer: React.FC<FilterDrawerProps> = ({
    open,
    onClose,
    title,
    filters,
    onApplyFilters,
    onResetFilters,
    children,
    width = 480,
    canReset = true,
    loading = false,
}) => {
    const hasActiveFilters = Object.keys(filters).length > 0;

    const handleApply = () => {
        onApplyFilters(filters);
        onClose();
    };

    const handleReset = () => {
        onResetFilters();
        onClose();
    };

    return (
        <Drawer
            title={
                <div className="flex items-center gap-2">
                    <FilterOutlined />
                    <Title level={4} className="!mb-0">
                        {title}
                    </Title>
                </div>
            }
            placement="right"
            width={width}
            onClose={onClose}
            open={open}
            styles={{
                body: {
                    padding: 0,
                },
            }}
            footer={
                <div className="flex justify-between items-center">
                    <div>
                        {hasActiveFilters && (
                            <span className="text-sm text-gray-500">
                                {Object.keys(filters).length} filter
                                {Object.keys(filters).length !== 1 ? "s" : ""}{" "}
                                active
                            </span>
                        )}
                    </div>
                    <Space>
                        {canReset && hasActiveFilters && (
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={handleReset}
                                disabled={loading}
                            >
                                Reset All
                            </Button>
                        )}
                        <Button
                            type="primary"
                            icon={<FilterOutlined />}
                            onClick={handleApply}
                            loading={loading}
                        >
                            Apply Filters
                        </Button>
                    </Space>
                </div>
            }
        >
            <div className="p-6">{children}</div>
        </Drawer>
    );
};

export default FilterDrawer;
