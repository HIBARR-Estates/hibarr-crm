import { Property } from "@/Types";
import { TFilter } from "@/Types/common";

export const isLoading = ({
    isError,
    isLoading,
    status,
}: Partial<{
    isLoading: boolean;
    isError: boolean;
    status: "idle" | "error" | "success" | "pending";
}>): boolean => {
    if (status === "pending") return true;
    return isLoading === true && isError !== true;
};

export const pluralOrSingular = (
    count: number,
    singular: string,
    plural: string
) => {
    return count === 1 ? singular : `${count} ${plural}`;
};

export const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
        available: "#bdbec3",
        under_offer: "orange",
        sold: "red",
        rented: "blue",
        withdrawn: "default",
        pending: "#faad14",
        error: "#ff4d4f",
        success: "#52c41a",
        idle: "gray",
        default: "#d9d9d9",
        completed: "green",
        cancelled: "red",
        scheduled: "blue",
        accepted: "#52c41a",
        declined: "#ff4d4f",
        rejected: "#ff4d4f",
        started: "#1890ff",
        paused: "#faad14",
        closed: "#595959",
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

export const formatCurrency = (
    amount: number,
    currencyCode: string | null | undefined = "GBP"
): string => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode || "GBP",
        minimumFractionDigits: 0,
    }).format(amount);
};

// Property price can be stored as:
// - number (legacy)
// - JSON string: {"amount":1000,"currency":"TRY"}
// - object: {amount, currency}
export const parsePropertyPrice = (
    price: any,
    defaultCurrency: string = "TRY"
): { amount: number; currency: string } => {
    const fallback = { amount: 0, currency: defaultCurrency };

    if (price === null || price === undefined) return fallback;

    // number
    if (typeof price === "number" && !isNaN(price)) {
        return { amount: price, currency: defaultCurrency };
    }

    // string: numeric or JSON
    if (typeof price === "string") {
        const trimmed = price.trim();
        if (!trimmed) return fallback;

        // numeric string
        const asNum = Number(trimmed);
        if (!isNaN(asNum)) {
            return { amount: asNum, currency: defaultCurrency };
        }

        // JSON string
        try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === "number" && !isNaN(parsed)) {
                return { amount: parsed, currency: defaultCurrency };
            }
            if (parsed && typeof parsed === "object") {
                const amount = Number((parsed as any).amount);
                const currency = (parsed as any).currency || defaultCurrency;
                return {
                    amount: !isNaN(amount) ? amount : 0,
                    currency,
                };
            }
        } catch {
            return fallback;
        }
    }

    // object
    if (typeof price === "object") {
        const amount = Number((price as any).amount);
        const currency = (price as any).currency || defaultCurrency;
        return {
            amount: !isNaN(amount) ? amount : 0,
            currency,
        };
    }

    return fallback;
};

export const formatNumber = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
};

export const formatCurrencyWithSymbol = (amount: number, symbol: string): string => {
    const s = symbol || "";
    return `${s}${formatNumber(amount)}`;
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
