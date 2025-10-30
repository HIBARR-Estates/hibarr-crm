export type TGenericEntityAction =
    | "edit"
    | "delete"
    | "view"
    | "add"
    | "import"
    | "export"
    | "filter"
    | "change_to_client"
    | "add_follow_up"
    | "change_stage"
    | "add_deal_agents";

export interface IModalProps {
    open: boolean;
    onClose: (operationSucceeded?: boolean) => void;
}

export type TFilter = Partial<{
    search: string;
    property_type: string;
    lead_type: string;
    start_date: string;
    end_date: string;
    lead_source: string;
    lead_owner_id: number;
    added_by_id: number;
    sale_type: string;
    status: string;
    city: string;
    min_price: number;
    max_price: number;
    lead_pipeline_id: number;
    pipeline_stage_id: number;
    category_id: number;
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
