import FilterBox, { FilterItem, SearchFilter } from "@/Components/FilterBox";
import { TFilter } from "@/Types/common";
import { Select, Input } from "antd";
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

const BasicPropertyFilterBox: React.FC<Props> = ({
    filters,
    handleQuickFilter,
    handleResetQuickFilters,
    handleResetFilters,
    handleSubmit,
}) => {
    const {
        search,
        property_type,
        sale_type,
        status,
        city,
        min_price,
        max_price,
    } = filters;
    return (
        <FilterBox
            onReset={handleResetFilters}
            showReset={Object.keys(filters).length > 0}
            handleSubmit={() => handleSubmit(filters)}
        >
            {/* Search Filter */}
            <SearchFilter
                placeholder="Search properties by title, description, or location..."
                value={search}
                onChange={(value) => handleQuickFilter("search", value)}
                onSearch={(value) => {
                    handleResetQuickFilters();
                    handleSubmit({ search: value });
                }}
            />

            {/* Property Type Filter */}
            <FilterItem label="Type">
                <Select
                    value={property_type || "all"}
                    onChange={(value) =>
                        handleQuickFilter("property_type", value)
                    }
                    style={{ minWidth: 150 }}
                    size="middle"
                    placeholder="All Types"
                    showSearch
                    optionFilterProp="children"
                    options={[
                        { label: "All Types", value: "all" },
                        // Housing Types
                        { label: "Villa", value: "Villa" },
                        { label: "Twin Villa", value: "Twin Villa" },
                        { label: "Apartment", value: "Apartment" },
                        { label: "Family Home", value: "Family Home" },
                        { label: "Townhouse", value: "Townhouse" },
                        { label: "Loft", value: "Loft" },
                        { label: "Penthouse", value: "Penthouse" },
                        { label: "Bungalow", value: "Bungalow" },
                        {
                            label: "Commercial Property",
                            value: "Commercial Property",
                        },
                        {
                            label: "Block of Apartments",
                            value: "Block of apartments",
                        },
                        {
                            label: "Complete Building",
                            value: "Complete Building",
                        },
                        {
                            label: "Abandoned Building",
                            value: "Abandoned Building",
                        },
                        { label: "Residence", value: "Residence" },
                        {
                            label: "Half Construction",
                            value: "Half Construction",
                        },
                        { label: "Time Share", value: "Time Share" },
                        // Land Types
                        {
                            label: "Residentially Zoned Land",
                            value: "Residentially Zoned Land",
                        },
                        { label: "Field", value: "Field" },
                        {
                            label: "Res. & Com. Zoned Land",
                            value: "Residentially and Commercially Zoned Land",
                        },
                        {
                            label: "Commercially Zoned Land",
                            value: "Commercially Zoned Land",
                        },
                        {
                            label: "Industrially Zoned Land",
                            value: "Industrially Zoned land",
                        },
                        {
                            label: "Tourism Zoned Land",
                            value: "Tourism Zoned Land",
                        },
                        { label: "Olive Grove", value: "Olive Grove" },
                        // Commercial Types
                        { label: "Shop", value: "Shop" },
                        { label: "Hotel", value: "Hotel" },
                        { label: "Workplace", value: "Workplace" },
                        { label: "Warehouse", value: "Warehouse" },
                        {
                            label: "Workplace for Sale",
                            value: "Workplace for sale",
                        },
                        { label: "Office", value: "Office" },
                    ]}
                />
            </FilterItem>

            {/* Sale Type Filter */}
            <FilterItem label="Sale Type">
                <Select
                    value={sale_type || "all"}
                    onChange={(value) => handleQuickFilter("sale_type", value)}
                    style={{ minWidth: 120 }}
                    size="middle"
                    placeholder="All"
                    options={[
                        { value: "all", label: "All" },
                        { value: "For Sale", label: "For Sale" },
                        { value: "For Rent", label: "For Rent" },
                        {
                            value: "For Daily Rental",
                            label: "For Daily Rental",
                        },
                    ]}
                />
            </FilterItem>

            {/* Status Filter */}
            <FilterItem label="Status">
                <Select
                    value={status || "all"}
                    onChange={(value) => handleQuickFilter("status", value)}
                    style={{ minWidth: 130 }}
                    size="middle"
                    placeholder="All Status"
                    options={[
                        { label: "All Status", value: "all" },
                        { label: "Available", value: "Available" },
                        { label: "Under Offer", value: "Under offer" },
                        { label: "Sold", value: "Sold" },
                        { label: "Rented", value: "Rented" },
                        { label: "Withdrawn", value: "Withdrawn" },
                    ]}
                />
            </FilterItem>

            {/* City Filter */}
            <FilterItem label="City">
                <Input
                    placeholder="Enter city"
                    value={city || ""}
                    onChange={(e) => handleQuickFilter("city", e.target.value)}
                    style={{ minWidth: 120 }}
                    size="middle"
                    allowClear
                />
            </FilterItem>

            {/* Price Range Filter */}
            <FilterItem label="Price Range">
                <Select
                    value={
                        min_price && max_price
                            ? `${min_price}-${max_price}`
                            : "all"
                    }
                    onChange={(value) => {
                        if (value === "all") {
                            handleQuickFilter("min_price", undefined);
                            handleQuickFilter("max_price", undefined);
                        } else {
                            const [min, max] = value.split("-");
                            handleQuickFilter("min_price", Number(min));
                            handleQuickFilter("max_price", Number(max));
                        }
                    }}
                    style={{ minWidth: 150 }}
                    size="middle"
                    placeholder="Any Price"
                    options={[
                        { value: "all", label: "Any Price" },
                        { value: "0-100000", label: "$0 - $100K" },
                        { value: "100000-250000", label: "$100K - $250K" },
                        { value: "250000-500000", label: "$250K - $500K" },
                        { value: "500000-1000000", label: "$500K - $1M" },
                        { value: "1000000-2000000", label: "$1M - $2M" },
                        { value: "2000000-999999999", label: "$2M+" },
                    ]}
                />
            </FilterItem>
        </FilterBox>
    );
};

export default BasicPropertyFilterBox;
