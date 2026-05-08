import type React from "react";

export interface LaravelPaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

export interface EmptyStateConfig {
    title?: string;
    description?: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
}
