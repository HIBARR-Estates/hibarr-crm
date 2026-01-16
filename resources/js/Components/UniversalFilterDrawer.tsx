import React from "react";
import { Drawer, Button, Space, Skeleton, Modal } from "antd";
import { FilterOutlined } from "@ant-design/icons";
import { useFilter, FilterConfig } from "@/contexts/FilterContext";
import UniversalFilterForm from "@/Components/UniversalFilterForm";

interface UniversalFilterDrawerProps {
    config: FilterConfig;
    width?: number;
    loading?: boolean;
}

const UniversalFilterDrawer: React.FC<UniversalFilterDrawerProps> = ({
    config,
    width = 480,
    loading = false,
}) => {
    const {
        isDrawerOpen,
        closeDrawer,
        applyFilters,
        resetFilters,
        getActiveFilterCount,
    } = useFilter();

    const activeFilterCount = getActiveFilterCount();

    return (
        <Modal
            title={
                <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <FilterOutlined />
                        {config.title}
                    </span>
                    {activeFilterCount > 0 && (
                        <span className="text-sm text-gray-500">
                            ({activeFilterCount} active)
                        </span>
                    )}
                </div>
            }
            open={isDrawerOpen}
            onCancel={closeDrawer}
            width={width}
            // placement="right"
            footer={
                <div className="flex justify-between">
                    <Button onClick={resetFilters}>Reset All</Button>
                    <Space>
                        <Button onClick={closeDrawer}>Cancel</Button>
                        <Button type="primary" onClick={applyFilters}>
                            Apply Filters
                        </Button>
                    </Space>
                </div>
            }
        >
            <Skeleton active loading={loading} paragraph={{ rows: 6 }}>
                <UniversalFilterForm config={config} />
            </Skeleton>
        </Modal>
    );
};

export default UniversalFilterDrawer;
