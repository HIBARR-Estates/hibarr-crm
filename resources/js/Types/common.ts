export type TGenericEntityAction =
    | "edit"
    | "delete"
    | "view"
    | "add"
    | "import"
    | "export"
    | "filter";

export interface IModalProps {
    open: boolean;
    onClose: (operationSucceeded?: boolean) => void;
}

export type TFilter = Partial<{
    search: string;
    property_type: string;
    sale_type: string;
    status: string;
    city: string;
    min_price: number;
    max_price: number;
}>;

export type Currency = {
    id: number;
    company_id: number;
    currency_name: string;
    currency_symbol: string;
    exchange_rate: number;
    is_cryptocurrency: "yes" | "no";
    usd_price: number | null;
    created_at: string;
    updated_at: string;
    // TODO: Add other fields as necessary
};
