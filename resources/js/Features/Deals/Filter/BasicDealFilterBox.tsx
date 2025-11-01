import FilterBox, { FilterItem, SearchFilter } from "@/Components/FilterBox";
import { TFilter } from "@/Types/common";
import { usePage } from "@inertiajs/react";
import { Select, Input, DatePicker } from "antd";
import dayjs from "dayjs";
import React, { useState } from "react";

interface Props {
    filters: TFilter;
    handleQuickFilter: (
        key: keyof TFilter,
        value: TFilter[keyof TFilter]
    ) => void;
    handleResetQuickFilters: () => void;
    handleResetFilters: () => void;
    handleSubmit: (value: TFilter) => void;
}

const BasicDealFilterBox: React.FC<Props> = ({
    filters,
    handleQuickFilter,
    handleResetQuickFilters,
    handleResetFilters,
    handleSubmit,
}) => {
    const {
        lead_pipeline_id,
        pipeline_stage_id,
        category_id,
        search,
        start_date,
        end_date,
    } = filters;
    const [pipelineId, setPipelineId] = useState<number>();
    const { props } = usePage<any>();

    const {
        leadContacts = [],
        leadPipelines = [],
        categories = [],
        products = [],
        employees = [],
        leadAgents = [],
        stage = null,
        contactID = null,
        columnId = null,
        company = {},
        stages = [],
    } = props;

    return (
        <FilterBox
            onReset={handleResetFilters}
            showReset={Object.keys(filters).length > 0}
            handleSubmit={() => handleSubmit(filters)}
        >
            {/* Search Filter */}
            <SearchFilter
                placeholder="Search leads by contact name, email, ..."
                value={search || ""}
                onChange={(value) => handleQuickFilter("search", value)}
                onSearch={(value) => {
                    handleResetQuickFilters();
                    handleSubmit({ search: value });
                }}
            />

            {/* Property Type Filter */}
            <FilterItem label="Pipeline">
                <Select
                    value={lead_pipeline_id || "all"}
                    onChange={(value) =>
                        handleQuickFilter("lead_pipeline_id", value)
                    }
                    style={{ minWidth: 150 }}
                    size="middle"
                    placeholder="Type"
                    showSearch
                    optionFilterProp="children"
                    options={leadPipelines.map((pipeline: any) => ({
                        label: pipeline.name,
                        value: pipeline.id,
                    }))}
                />
            </FilterItem>

            {/* Stage */}
            <FilterItem label="Stage">
                <Select
                    value={pipeline_stage_id || "all"}
                    onChange={(value) =>
                        handleQuickFilter("pipeline_stage_id", value)
                    }
                    style={{ minWidth: 130 }}
                    size="middle"
                    placeholder="Stage"
                >
                    {stages
                        .filter((stage: any) =>
                            pipelineId
                                ? stage.lead_pipeline_id === pipelineId
                                : false
                        )
                        .map((stage: any) => (
                            <Select.Option key={stage.id} value={stage.id}>
                                <span
                                    className="inline-block w-2 h-2 rounded-full mr-2"
                                    style={{
                                        backgroundColor: stage.label_color,
                                    }}
                                ></span>
                                {stage.name}
                            </Select.Option>
                        ))}
                </Select>
            </FilterItem>

            <FilterItem label="Duration">
                <DatePicker.RangePicker
                    value={[
                        start_date ? dayjs(start_date) : null,
                        end_date ? dayjs(end_date) : null,
                    ]}
                    onChange={(_, dateStrings) => {
                        handleQuickFilter(
                            "start_date",
                            dateStrings[0] || undefined
                        );
                        handleQuickFilter(
                            "end_date",
                            dateStrings[1] || undefined
                        );
                    }}
                    style={{ minWidth: 250 }}
                    size="middle"
                />
            </FilterItem>

            <FilterItem label="Category">
                <Select
                    value={category_id || "all"}
                    onChange={(value) =>
                        handleQuickFilter("category_id", value)
                    }
                    style={{ minWidth: 150 }}
                    size="middle"
                    placeholder="Category"
                    showSearch
                    optionFilterProp="children"
                    options={categories.map((category: any) => ({
                        label: category.category_name,
                        value: category.id,
                    }))}
                />
            </FilterItem>
        </FilterBox>
    );
};

export default BasicDealFilterBox;
