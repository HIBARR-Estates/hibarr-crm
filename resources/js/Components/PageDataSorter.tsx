import React from "react";
import { CaretUpOutlined, CaretDownOutlined } from "@ant-design/icons";
import usePageSort from "@/Hooks/usePageSort";

interface PageDataSorterProps {
    field: string;
    routeName?: string;
    className?: string;
    label?: string;
}

const PageDataSorter: React.FC<PageDataSorterProps> = ({
    label,
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
            title={label}
        >
            <CaretUpOutlined
                className={`text-xs -mb-1 hover:opacity-50`}
                style={{
                    color: `${
                        isActive && sortDirection === "asc"
                            ? "#3b82f6"
                            : "#6b7280"
                    }`,
                }}
            />
            <CaretDownOutlined
                className={`text-xs hover:opacity-50`}
                style={{
                    color: `${
                        isActive && sortDirection === "desc"
                            ? "#3b82f6"
                            : "#6b7280"
                    }`,
                }}
            />
        </span>
    );
};

export default PageDataSorter;
