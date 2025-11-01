import FilterBox, { FilterItem, SearchFilter } from "@/Components/FilterBox";
import { TFilter } from "@/Types/common";
import { usePage } from "@inertiajs/react";
import { Select, Input, DatePicker } from "antd";
import dayjs from "dayjs";
import React from "react";

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

const BasicLeadFilterBox: React.FC<Props> = ({
    filters,
    handleQuickFilter,
    handleResetQuickFilters,
    handleResetFilters,
    handleSubmit,
}) => {
    const { props } = usePage<any>();
    const { sources } = props;
    const {
        search,
        lead_type,
        start_date,
        end_date,
        lead_owner_id,
        added_by_id,
        lead_source,
    } = filters;
    return (
        <FilterBox
            onReset={handleResetFilters}
            showReset={Object.keys(filters).length > 0}
            handleSubmit={() => handleSubmit(filters)}
        >
            {/* Search Filter */}
            <SearchFilter
                placeholder="Search leads by contact name, email, ..."
                value={search}
                onChange={(value) => handleQuickFilter("search", value)}
                onSearch={(value) => {
                    handleResetQuickFilters();
                    handleSubmit({ search: value });
                }}
            />

            {/* TODO: Confirm te orginal implementation and adjust accordignly */}
            {/* Property Type Filter */}
            <FilterItem label="Type">
                <Select
                    value={lead_type || "all"}
                    onChange={(value) => handleQuickFilter("lead_type", value)}
                    style={{ minWidth: 150 }}
                    size="middle"
                    placeholder="Type"
                    showSearch
                    optionFilterProp="children"
                    options={[
                        { label: "All", value: "all" },
                        // Housing Types
                        { label: "Lead", value: "lead" },
                        { label: "Client", value: "client" },
                    ]}
                />
            </FilterItem>

            {/* Sale Type Filter */}
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

            {/* Lead Source Filter */}
            <FilterItem label="Lead Source">
                <Select
                    value={lead_source || "all"}
                    onChange={(value) =>
                        handleQuickFilter("lead_source", value)
                    }
                    style={{ minWidth: 130 }}
                    size="middle"
                    placeholder="Lead Source"
                    filterOption={(input, option) =>
                        (option?.children as unknown as string)
                            ?.toLowerCase()
                            .includes(input.toLowerCase())
                    }
                >
                    {sources?.map((source: any) => (
                        <Select.Option key={source.id} value={source.id}>
                            {source.type}
                        </Select.Option>
                    ))}
                </Select>
            </FilterItem>
        </FilterBox>
    );
};

export default BasicLeadFilterBox;
