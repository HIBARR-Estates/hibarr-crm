import React from "react";
import { Button, Space, Modal } from "antd";
import { FilterOutlined } from "@ant-design/icons";
import { useFilter, FilterConfig } from "@/contexts/FilterContext";
import UniversalFilterForm from "@/Components/UniversalFilterForm";
import { useTranslation } from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface UniversalFilterDrawerProps {
    config: FilterConfig;
    width?: number;
    /** Remote option data still loading — surfaced per-field, not as a whole-modal skeleton. */
    loading?: boolean;
}

const UniversalFilterDrawer: React.FC<UniversalFilterDrawerProps> = ({
    config,
    width = 480,
    loading = false,
}) => {
    const { t } = useTranslation();
    const { td } = useTd();
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
                        {td(config.title, { source: "en" })}
                    </span>
                    {activeFilterCount > 0 && (
                        <span className="text-sm text-gray-500">
                            {t("pages.filters.active_n", { n: activeFilterCount })}
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
                    <Button onClick={resetFilters}>{t("pages.filters.reset_all")}</Button>
                    <Space>
                        <Button onClick={closeDrawer}>{t("pages.filters.cancel")}</Button>
                        <Button type="primary" onClick={applyFilters}>
                            {t("pages.filters.apply_filters_btn")}
                        </Button>
                    </Space>
                </div>
            }
        >
            <UniversalFilterForm config={config} optionsLoading={loading} />
        </Modal>
    );
};

export default UniversalFilterDrawer;
