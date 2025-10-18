import { Property } from "@/Types";
import { TFilter } from "@/Types/common";

export const pluralOrSingular = (
    count: number,
    singular: string,
    plural: string
) => {
    return count === 1 ? singular : `${count} ${plural}`;
};

export const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
        Available: "green",
        "Under offer": "orange",
        Sold: "red",
        Rented: "blue",
        Withdrawn: "default",
    };
    return colors[status] || "default";
};

export const getPropertyTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
        Villa: "purple",
        Apartment: "blue",
        House: "green",
        Office: "orange",
        Shop: "red",
        Warehouse: "default",
    };
    return colors[type] || "default";
};

export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
    }).format(amount);
};

export const truncateText = (text: string, maxLength: number = 200): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
};

export const filterProperties = (
    data: Property[],
    filters: TFilter
): Property[] => {
    return data.filter((property) => {
        // Search filter - check title, description, city, and area
        if (filters.search && filters.search.trim()) {
            const searchTerm = filters.search.toLowerCase();
            const matchesSearch =
                property.title.toLowerCase().includes(searchTerm) ||
                (property.description &&
                    property.description.toLowerCase().includes(searchTerm)) ||
                property.city.toLowerCase().includes(searchTerm) ||
                property.area.toLowerCase().includes(searchTerm);

            if (!matchesSearch) return false;
        }

        // Property type filter
        if (filters.property_type && filters.property_type !== "all") {
            if (property.property_type !== filters.property_type) return false;
        }

        // Sale type filter
        if (filters.sale_type && filters.sale_type !== "all") {
            if (property.sale_type !== filters.sale_type) return false;
        }

        // Status filter
        if (filters.status && filters.status !== "all") {
            if (property.status !== filters.status) return false;
        }

        // City filter
        if (filters.city && filters.city.trim()) {
            if (
                !property.city
                    .toLowerCase()
                    .includes(filters.city.toLowerCase())
            )
                return false;
        }

        // Price range filters
        if (filters.min_price !== undefined && filters.min_price !== null) {
            if (property.price < filters.min_price) return false;
        }

        if (filters.max_price !== undefined && filters.max_price !== null) {
            if (property.price > filters.max_price) return false;
        }

        return true;
    });
};
