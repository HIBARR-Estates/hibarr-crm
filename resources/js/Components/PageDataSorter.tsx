import React from "react";
import { CaretUpOutlined, CaretDownOutlined } from "@ant-design/icons";
import usePageSort from "@/Hooks/usePageSort";

interface PageDataSorterProps {
    field: string;
    routeName?: string;
    className?: string;
}

const PageDataSorter: React.FC<PageDataSorterProps> = ({
    field,
    routeName,
    className = "",
}) => {
    const { handleSort, getSortState, isFieldSorted } = usePageSort({
        routeName,
    });

    const sortDirection = getSortState(field);
    const isActive = isFieldSorted(field);

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleSort(field);
    };

    return (
        <span
            className={`inline-flex flex-col ml-1 cursor-pointer transition-colors ${className}`}
            onClick={handleClick}
        >
            <CaretUpOutlined
                className={`text-xs -mb-1 ${
                    isActive && sortDirection === "asc"
                        ? "text-blue-500"
                        : "text-gray-400 hover:text-gray-600"
                }`}
            />
            <CaretDownOutlined
                className={`text-xs ${
                    isActive && sortDirection === "desc"
                        ? "text-blue-500"
                        : "text-gray-400 hover:text-gray-600"
                }`}
            />
        </span>
    );
};

export default PageDataSorter;
