import React from "react";
import { Input } from "antd";
import { useFilter } from "@/contexts/FilterContext";

interface UniversalSearchBoxProps {
    placeholder?: string;
    searchKey?: string;
}

const UniversalSearchBox: React.FC<UniversalSearchBoxProps> = ({
    placeholder = "Search...",
    searchKey = "search",
}) => {
    const { filters, setFilter } = useFilter();
    const searchValue = filters[searchKey] || "";

    const handleSearch = (value: string) => {
        setFilter(searchKey, value, "Search", value);
    };

    return (
        <div className="w-full max-w-md">
            <Input.Search
                placeholder={placeholder}
                value={searchValue}
                onChange={(e) => handleSearch(e.target.value)}
                onSearch={handleSearch}
                allowClear
                className="w-full"
            />
        </div>
    );
};

export default UniversalSearchBox;
