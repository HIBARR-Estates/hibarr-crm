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
