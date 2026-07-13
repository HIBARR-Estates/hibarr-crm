import { User } from "..";

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

import { LeadLifecycleStatus } from "@/Types/qualification";

import { ILeadFlightItinerary } from './lead-flight-itinerary';

export interface Lead {
    id: number;
    lead_flight_itineraries?: ILeadFlightItinerary[];
    added_by?: User | null;
    lead_owner?: User | null;
    client_id?: number | null;
    salutation?: string | null;
    salutation_value?: string | null;
    gender?: "male" | "female" | null;
    gender_value?: "male" | "female" | null;
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
    marketing?: LeadMarketing | null;
    lifecycle_status_id?: number | null;
    lead_lifecycle_status?: LeadLifecycleStatus | null;
    languages?: string[];
    date_of_birth?: string | null;
    age?: number | null;
    age_range?: string | null;
    nationality?: string | null;
    occupation?: string | null;

    // Custom Fields
    // custom_fields?: Record<string, any>;
    custom_fields_data?: Record<string, any>;
}

export interface LeadMarketing {
    id: number;
    lead_id: number;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
    utm_audience?: string | null;
    traffic_source_id?: string | null;
    facebook_click_id?: string | null;
    facebook_lead_id?: string | null;
    facebook_browser_id?: string | null;
    user_agent?: string | null;
    ip_address?: string | null;
    has_registered_for_the_webinar: boolean;
    has_joined_the_facebook_group: boolean;
    has_downloaded_the_ebook: boolean;
    has_attended_the_webinar: boolean;
    registered_for_zoom_meeting: boolean;
    last_webinar_date?: string | null;
    contact_score?: number | null;
    created_at?: string;
    updated_at?: string;
}

export interface LeadCategory {
    id: number;
    category_name: string;
}

export interface LeadSource {
    id: number;
    type: string;
}

// Form data interfaces
export interface CreateLeadFormData {
    salutation?: string;
    gender?: "male" | "female" | null;
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
    languages?: string[];
    date_of_birth?: string | null;
    age?: number | null;
    age_range?: string | null;
    nationality?: string | null;
    occupation?: string | null;
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
