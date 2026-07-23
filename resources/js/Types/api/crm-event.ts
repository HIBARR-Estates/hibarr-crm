/**
 * CRM Event Engine TypeScript types.
 *
 * Mirrors the JSON responses from:
 *   GET  /api/v1/crm-events
 *   GET  /api/v1/crm-events/{uuid}
 *   GET  /api/v1/crm-event-types
 *   POST /api/v1/crm-events
 */

export interface CrmEventCategory {
    slug: string;
    name: string;
}

export interface CrmEventType {
    slug: string;
    name: string;
    description: string | null;
    model_type: string | null;
    is_system: boolean;
    sync_processing: boolean;
    metadata_schema: Record<string, MetadataFieldSchema> | null;
    category: CrmEventCategory | null;
    business_rule: { slug: string; name: string } | null;
}

/**
 * Describes one field inside an event type's metadata_schema.
 * Example: { "property_id": { "type": "number", "label": "Property", "required": true } }
 */
export interface MetadataFieldSchema {
    type?: "string" | "number" | "boolean" | "date" | "select" | "textarea";
    label?: string;
    required?: boolean;
    placeholder?: string;
    options?: Array<{ label: string; value: string }>;
    default?: any;
}

export type CrmEventStatus =
    | "completed"
    | "error_occurred"
    | "missed"
    | "rejected";
export type CrmEventDirection = "inbound" | "outbound";
export type CrmEventGenerationType =
    | "user_generated"
    | "system_generated"
    | "external";

export interface CrmEventUser {
    id: number;
    name: string;
}

export interface CrmEvent {
    uuid: string;
    event_type: {
        slug: string;
        name: string;
        /** System-seeded type (auto-recorded) vs custom type (agent-logged). */
        is_system?: boolean;
        category: CrmEventCategory | null;
    } | null;
    generation_type: CrmEventGenerationType;
    status: CrmEventStatus;
    direction: CrmEventDirection | null;
    user_id: number | null;
    user: CrmEventUser | null;
    model_type: string | null;
    model_id: number | null;
    correlation_id: string | null;
    causation_id: number | null;
    source: string | null;
    ip_address: string | null;
    metadata: Record<string, any> | null;
    occurred_at: string;
    created_at: string;
    causation?: {
        uuid: string;
        event_type_slug: string | null;
        occurred_at: string;
    } | null;
    effects?: Array<{
        uuid: string;
        event_type_slug: string | null;
        occurred_at: string;
    }>;
}

export interface CrmEventsIndexResponse {
    status: string;
    data: CrmEvent[];
    meta: {
        current_page: number;
        per_page: number;
        total: number;
        total_pages: number;
        has_more: boolean;
    };
}

export interface CrmEventTypesResponse {
    status: string;
    data: CrmEventType[];
}

export interface CrmEventStorePayload {
    event_type_slug: string;
    model_type?: string;
    model_id?: number;
    user_id?: number;
    generation_type?: CrmEventGenerationType;
    status?: CrmEventStatus;
    direction?: CrmEventDirection;
    correlation_id?: string;
    causation_id?: number;
    metadata?: Record<string, any>;
    occurred_at?: string;
}

export interface CrmEventStoreResponse {
    status: string;
    message: string;
    data?: CrmEvent;
}

export interface CrmEventsQueryParams {
    model_type?: string;
    model_id?: number;
    event_type_slug?: string;
    category_slug?: string;
    user_id?: number;
    generation_type?: string;
    status?: string;
    direction?: string;
    source?: string;
    date_from?: string;
    date_to?: string;
    per_page?: number;
    sort_by?: string;
    sort_order?: "asc" | "desc";
}
