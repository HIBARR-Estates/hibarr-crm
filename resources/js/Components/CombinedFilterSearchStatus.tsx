import React from "react";
import { Space } from "antd";
import ContextualActiveFilters from "./ContextualActiveFilters";
import SearchStatusIndicator from "./SearchStatusIndicator";

interface CombinedFilterSearchStatusProps {
    showSearchStatus?: boolean;
    className?: string;
}

const CombinedFilterSearchStatus: React.FC<CombinedFilterSearchStatusProps> = ({
    showSearchStatus = true,
    className = "",
}) => {
    return (
        <div className={`px-6 py-2 space-y-2 ${className}`}>
            {/* Search Status */}
            {showSearchStatus && <SearchStatusIndicator />}

            {/* Filter Status */}
            <ContextualActiveFilters />
        </div>
    );
};

export default CombinedFilterSearchStatus;
