import FilterBox, { SearchFilter } from "@/Components/FilterBox";
import { TFilter } from "@/Types/common";
import React from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";

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
    const { td } = useTd();
    const { search } = filters;
    return (
        <FilterBox
            onReset={handleResetFilters}
            showReset={Object.keys(filters).length > 0}
            handleSubmit={() => handleSubmit(filters)}
        >
            {/* Search Filter */}
            <SearchFilter
                placeholder={td("Search leads by contact name, email, ...", { source: "en" })}
                value={search}
                onChange={(value) => handleQuickFilter("search", value)}
                onSearch={(value) => {
                    handleResetQuickFilters();
                    handleSubmit({ search: value });
                }}
            />
        </FilterBox>
    );
};

export default BasicLeadFilterBox;
