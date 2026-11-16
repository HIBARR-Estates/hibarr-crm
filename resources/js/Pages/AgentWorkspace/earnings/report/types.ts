export type ReportRange = "week" | "month" | "last_month" | "quarter" | "year";

export const REPORT_RANGES: ReportRange[] = ["week", "month", "last_month", "quarter", "year"];

/** ReportWindows: the dates a period covers and the period before it. */
export interface ReportWindow {
    key: ReportRange;
    start: string;
    end: string;
    prev_start: string;
    prev_end: string;
}

export type ReportWindows = Record<ReportRange, ReportWindow>;

export interface ReportCounts {
    leads: number;
    deals_created: number;
    deals_closed: number;
    meetings: number;
}

/** MyReportController: the cards for one period, and the period before for comparison. */
export interface ReportKpi {
    range: ReportRange;
    start: string;
    end: string;
    current: ReportCounts & { lead_notes: number; deal_notes: number };
    previous: ReportCounts;
    prev_start: string;
}

export type ReportTab = "leads" | "deals-created" | "deals-closed" | "meetings" | "notes";

/** A page of one of the classic Agent Reports lists (Laravel's paginator). */
export interface ReportPage<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
}

export interface ReportLead {
    id: number;
    client_name: string;
    client_email: string | null;
    lead_source: { type: string } | null;
    created_at: string;
}

export interface ReportDeal {
    id: number;
    name: string;
    value: string | number | null;
    lead_id: number | null;
    created_at?: string;
    close_date?: string | null;
    contact: { id: number; client_name: string; lead_source?: { type: string } | null } | null;
    lead_stage?: { name: string; label_color?: string | null } | null;
    currency?: { currency_symbol: string } | null;
}

export interface ReportMeeting {
    id: number;
    next_follow_up_date: string | null;
    status: string | null;
    duration: number | null;
    deal: { id: number; name: string; lead_id?: number | null; contact?: { client_name: string } | null } | null;
    meeting_type: { name: string } | null;
}

export interface ReportNote {
    id: number;
    title: string | null;
    details: string | null;
    created_at: string;
    lead?: { id: number; client_name: string } | null;
    deal?: { id: number; name: string; lead_id?: number | null; contact?: { client_name: string } | null } | null;
}
