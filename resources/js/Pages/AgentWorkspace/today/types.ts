import type { QueueTask, ScheduleEntry } from "@/Types/personal-work";

/** DashboardMetricsService::personalQueue. `counts` are true totals; `tasks` is capped. */
export interface PersonalQueue {
    tasks: QueueTask[];
    counts: { overdue: number; today: number; later: number };
    /** Open records with no next step nominated. */
    uncovered: { leads: number; deals: number };
}

/** Today in the viewer's zone: meetings plus the tasks due today. */
export interface TodaySchedule {
    meetings: ScheduleEntry[];
    tasks: QueueTask[];
    /** Each deal's analysis progress by deal id, for the agenda's meeting chips. */
    analysis?: Record<string, DealAnalysisProgress>;
}

/** DealAnalysisProgress (server): done, or how many script fields hold a value. */
export interface DealAnalysisProgress {
    ready: boolean;
    filled: number;
    total: number;
}

export interface PersonalStats {
    leads: { new: number; contacted: number; uncontacted: number };
    meetings: { upcoming: number; attended: number; missed: number };
}

export interface CurrencyTotal {
    currency: string;
    total: number;
}

/** null for accounts without a lead_agent record, or no company currency. */
export interface CommissionSummary {
    earned: CurrencyTotal[];
    previous: CurrencyTotal[];
    pending: CurrencyTotal[];
}

export interface PipelineRow {
    id: number;
    name: string;
    deal_count: number;
    idle_count: number;
    totals: CurrencyTotal[];
}

export interface TaskCategoryOption {
    id: number;
    category_name: string;
}
