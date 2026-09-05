import { User } from "..";
import { Lead, LeadCategory, LeadSource } from "./leads";
import type { DealOfferApplication } from "./offers";

export interface PaginatedDealResponse {
    current_page: number;
    data: Deal[];
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

import { ILeadFlightItinerary } from './lead-flight-itinerary';

export interface Deal {
    id: number;
    lead_flight_itineraries?: ILeadFlightItinerary[];
    probability?: number;
    company_id?: number;
    name: string;
    column_priority?: number;
    lead_pipeline_id: number;
    pipeline_stage_id: number;
    lead_id: number;
    agent_id: null | number;
    category_id: null | number;
    next_follow_up: string;
    value: number;
    manual_value?: number;
    calculated_value?: number;
    value_source?: "manual" | "calculated";
    note?: null | string;
    hash?: string;
    currency_id?: number;
    added_by: null | number;
    last_updated_by?: number;
    close_date?: null | string;
    meeting_date?: null | string;
    created_at?: string;
    updated_at?: string;
    next_follow_up_date?: string | null;
    next_follow_up_status?: string | null;
    strategy_accepted?: number;
    packages?: {
        id: number;
        name: string;
        value?: number;
    }[];

    package_id?: number;
    downpayment_confirmed?: number;

    // Counts for kanban card display
    /** withCount('products') — linked properties, without loading the rows. */
    products_count?: number;
    tasks_count?: number;
    meetings_count?: number;
    activities_count?: number;

    // Relationships
    contact: Contact;
    lead_stage: LeadStage;
    lead_agent: LeadAgent | null;
    agent: LeadAgent | null;
    category?: LeadCategory | null;
    pipeline?: Pipeline | null;
    currency?: Currency;
    deal_watchers: DealWatcher[];
    deal_participants?: DealParticipant[];
    products?: Product[];
    services?: any[];
    lead_status?: LeadStatus | null;
    hibarr_fields?: HibarrDealFields | null;

    // Custom Fields
    // custom_fields?: Record<string, any>;
    custom_fields_data?: Record<string, any>;

    // Lock state
    is_locked?: boolean;
    locked_at?: string | null;
    // Set once commission has been distributed for a won deal — narrower
    // than is_locked: only the value (and packages/properties/offers that
    // feed it) is protected, not the whole deal.
    commission_locked?: boolean;
    commission_locked_at?: string | null;

    // Outcome (read-only in the redesign; set by automation / stage movement)
    outcome_status?: "won" | "lost" | null;

    // Analysis
    analysis_status?: "pending" | "completed";
    analysis_completed_at?: string | null;
    analysis_completed_by?: number | null;

    // Offers
    offer_applications?: DealOfferApplication[];
    total_discount?: number;
    value_breakdown?: {
        products_total: number;
        packages_total: number;
        gross_total: number;
        /** What the active source's adjustments come off: gross, or the manual value. */
        base_value: number;
        /** Raw offer-derived discount, whichever source is active. Only subtracted on a calculated deal. */
        offer_discount_total: number;
        /** The ad-hoc discount negotiated on the deal itself, applied to base_value. */
        manual_discount_total: number;
        /** offer_discount_total + manual_discount_total. */
        discount_total: number;
        deduction_total: number;
        deduction_note: string | null;
        discount_type: "percent" | "fixed" | null;
        discount_value: number | null;
        calculated_value: number;
        manual_value: number | null;
        value_source: "manual" | "calculated";
        /** base_value minus the active adjustments — what deals.value becomes on the next resolve. */
        computed_value: number;
        /** deals.value as stored. Every figure above is in the deal's own currency. */
        final_value: number;
        /** final_value expressed in company currency — what commission is computed against. */
        final_value_company: number;
        currency: {
            deal_code: string | null;
            deal_symbol: string | null;
            company_code: string | null;
            company_symbol: string | null;
            exchange_rate: number;
            is_converted: boolean;
        };
        // null when the viewer isn't the deal's agent, an admin, or granted
        // partner-network management — see PermissionGates::canViewDealCommission().
        commission: {
            /**
             * Every leg that paid a person, theirs flagged. Excludes the system
             * leg, so these sum to `paid`. Null unless the viewer holds
             * manage_partner_network or the admin role.
             */
            legs: Array<{
                agent_name: string;
                type: "agent" | "upline";
                percentage: number | null;
                amount: number;
                is_you: boolean;
            }> | null;
            /**
             * Total paid across every leg. Null unless the viewer holds
             * manage_partner_network or the admin role.
             */
            paid: number | null;
            /**
             * The rate behind `paid`, when one number describes it — level-based
             * legs share the deal value as their base and so add up. Null for a
             * fixed fee, or for package legs taken off differing bases.
             */
            percentage: number | null;
            /**
             * What this viewer personally earned on the deal — set for the agent
             * and any upline who took a differential, no permission required.
             * Null when the viewer earned nothing.
             */
            own: number | null;
            own_percentage: number | null;
            /**
             * The company's own margin. Null unless the viewer holds
             * manage_partner_network or the admin role.
             */
            revenue_to_company: number | null;
            deal_type: "package" | "property";
            // true when the deal hasn't been won yet (or commission wasn't
            // distributed for any other reason) — figures are a live
            // projection from current settings, not a persisted ledger.
            is_projected: boolean;
        } | null;
    };
}

export interface HibarrDealFields {
    id: number;
    deal_id: number;
    message?: string | null;
    interested_in?: string | null;
    motivation?: string | null;
    purchase_timeline?: string | null;
    budget_range?: string | null;
    strategy_meeting_booked: boolean;
    downpayment_paid: boolean;
    inspection_trip_date?: string | null;
    deposit_confirmation?: string | null;
    reservation_agreement?: string | null;
    sales_contract?: string | null;
    /** Appended by HibarrDealFields accessors — resolved download URLs. */
    deposit_confirmation_url?: string | null;
    reservation_agreement_url?: string | null;
    sales_contract_url?: string | null;
    created_at?: string;
    updated_at?: string;
}

interface LeadStatus {
    id: number;
    company_id: number;
    status_name: string;
    label_color: string;
    type: string;
    priority: number;
}

interface LeadAgent {
    id: number;
    user_id?: number;
    name: string;
    image?: string;
    user?: Pick<User, "id" | "name" | "email" | "image_url">;
}

interface DealWatcher {
    id: number;
    name: string;
    image?: string;
    image_url?: string;
    email?: string;
}

interface DealParticipant {
    id: number;
    name: string;
    image?: string;
    image_url?: string;
    email?: string;
}

interface LeadStage {
    id: number;
    name: string;
    slug?: string;
    priority?: number;
    label_color?: string;
}

interface Contact extends Lead {
    id: number;
    company_id?: number;
    client_id: null | number;
    source_id?: null;
    status_id?: null;
    column_priority?: number;
    company_name?: string;
    website?: string;
    address?: string;
    salutation?: string | null;
    client_name: string;
    client_email: string;
    client_whatsapp?: null;
    client_instagram?: null;
    client_telegram?: null;
    telegram_chat_id?: null;
    mobile?: null | string;
    cell?: null | string;
    // added_by?: number | null;
    office?: null | string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    note?: null;
    category_id?: null;
    last_updated_by?: null | number;
    hash?: string;
    created_at?: string;
    updated_at?: string;
    image_url?: string;
    client_name_salutation?: string;
    mobile_with_phonecode?: string;
    office_phone_formatted?: string;
}

interface Pipeline {
    id: number;
    company_id: number;
    name: string;
    slug: string;
    priority: number;
    label_color: string;
    default: number;
    added_by: null;
    stages?: PipelineStage[];
}

interface Currency {
    id: number;
    company_id: number;
    currency_name: string;
    currency_symbol: string;
    currency_code: string;
    exchange_rate: number;
    is_cryptocurrency: string;
    usd_price: null;
    currency_position: string;
    no_of_decimal: number;
    thousand_separator: string;
    decimal_separator: string;
}

interface Follow {
    id: number;
    deal_id: number;
    location: string;
    meeting_link: null;
    remark: null;
    next_follow_up_date: string;
    added_by: number;
    last_updated_by: number;
    event_id: null;
    meeting_id: null;
    summary_id: null;
    send_reminder: null;
    remind_time: null;
    remind_type: string;
    status: string;
    meeting_type_id: null;
}

interface Leadstage {
    id: number;
    company_id: number;
    lead_pipeline_id: number;
    name: string;
    slug: string;
    priority: number;
    default: number;
    label_color: string;
}

export type DealFormData = Omit<
    Deal,
    | "id"
    | "lead"
    | "agent"
    | "deal_watcher"
    | "category"
    | "products"
    | "contact"
    | "lead_stage"
    | "lead_agent"
    | "deal_watchers"
    | "follow"
    | "followup"
    | "currency"
    | "pipeline"
    | "lead_source"
>;

export interface PropertySummary {
    id: number;
    title: string | null;
    property_type: string | null;
    sale_type: string | null;
    price: number | null;
    bedrooms: string | null;
    bathrooms: number | null;
    city: string | null;
    area: string | null;
    land_size: string | null;
    status: string | null;
    photos: string[] | null;
    /** Appended on the model — project location first, own columns last. */
    effective_location?: { city: string | null; area: string | null } | null;
    unit_style?: string[] | null;
    view_types?: string[] | null;
    furniture_status?: string | null;
    primary_category?: string | null;
    construction_status?: string | null;
    developer_project?: {
        id: number;
        name: string;
        availability_link: string | null;
    } | null;
}

export interface Product {
    id: number;
    name: string;
    price?: number;
    description?: string;
    property?: PropertySummary;
}

export interface LeadPipeline {
    id: number;
    name: string;
    default: number;
    label_color?: string;
    stages?: PipelineStage[];
}

export interface PipelineStage {
    id: number;
    name: string;
    lead_pipeline_id: number;
    label_color: string;
    priority?: number;
}

export interface CreateDealFormData {
    name: string;
    lead_id?: number;
    lead_contact?: number;
    pipeline?: number;
    stage_id?: number;
    value?: number;
    manual_value?: number;
    value_source?: "manual" | "calculated";
    close_date?: string;
    category_id?: number;
    agent_id?: number;
    product_id?: number[];
    package_id?: number[];
    services?: number[];
    deal_watcher?: number[];
    deal_participant?: number[];
    strategy_accepted?: boolean;
    downpayment_confirmed?: boolean;
    custom_fields_data?: Record<string, any>;
    packages?: number[];
}

export interface EditDealFormData extends CreateDealFormData {
    id: number;
}

export interface DealActionResponse {
    status: string;
    message: string;
    redirectUrl?: string;
    add_more?: boolean;
}
