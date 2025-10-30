export interface PaginatedLeadResponse {
    current_page: number;
    data: Lead[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    links: Link[];
    next_page_url: string;
    path: string;
    per_page: number;
    prev_page_url: null;
    to: number;
    total: number;
}

interface Link {
    url: null | string;
    label: string;
    active: boolean;
}

export interface Lead {
    id: number;
    added_by?: User | null;
    lead_owner?: User | null;
    client_id?: number | null;
    salutation?: string | null;
    category_id?: number | null;
    source_id?: number | null;
    client_name?: string;
    client_email?: string;
    company_name?: string | null;
    website?: string | null;
    address?: string | null;
    mobile?: string | null;
    cell?: string | null;
    office?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postal_code?: string | null;
    note?: string | null;
    value?: number | null;
    currency_id?: number | null;
    image_url?: string;
    client_name_salutation?: string;
    mobile_with_phonecode?: string;
    office_phone_formatted?: string;
    category?: LeadCategory | null;
    lead_source?: LeadSource | null;
    leadSource?: LeadSource | null;
    client?: User | null;
    created_at?: string;
    updated_at?: string;

    // Custom Fields
    // custom_fields?: Record<string, any>;
    custom_fields_data?: Record<string, any>;
}

export interface LeadCategory {
    id: number;
    category_name: string;
}

export interface LeadSource {
    id: number;
    type: string;
}

export interface User {
    id: number;
    name: string;
    email: string;
    image_url: string;
    modules?: string[];
    mobile_with_phone_code?: string;
    name_salutation?: string;
    phone_number?: string;
    country_code?: string | null;
    session?: null;
    client_contact?: null;
}

// Form data interfaces
export interface CreateLeadFormData {
    salutation?: string;
    client_name: string;
    client_email: string;
    mobile?: string;
    company_name?: string;
    website?: string;
    address?: string;
    cell?: string;
    office?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    note?: string;
    source_id?: number;
    category_id?: number;
    lead_owner?: number;
    added_by?: number;
    create_deal?: boolean;
    create_client?: boolean;
    custom_fields_data?: Record<string, any>;
    // Deal creation fields
    name?: string; // Deal name
    pipeline?: number;
    stage_id?: number;
    value?: number;
    close_date?: string;
    agent_id?: number;
    product_id?: number[];
    deal_watcher?: number[];
}

// For editing leads
export interface EditLeadFormData extends CreateLeadFormData {
    id: number;
}

// Deprecated interface for backward compatibility
interface Addedby extends User {}

export interface LeadActionResponse {
    status: string;
    message: string;
    redirectUrl?: string;
}
