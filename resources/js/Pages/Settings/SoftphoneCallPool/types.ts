/**
 * Softphone call pool data contracts and response shapes.
 */

export interface PoolAgent {
    id: number;
    user_id: number;
    name: string | null;
    email: string | null;
    priority: number;
    active: boolean;
    tier?: string;
    can_receive_calls?: boolean;
    has_permission?: boolean;
}

export interface EligibleUser {
    id: number;
    name: string;
    email: string | null;
    can_receive_calls?: boolean;
    has_permission?: boolean;
}

export interface PoolResponse {
    status: string;
    data: {
        agents: PoolAgent[];
        tier?: string;
        fallback_seconds?: number;
        fallback_voice_message_enabled?: boolean;
        fallback_voice_message_url?: string | null;
        fallback_voice_message_text?: string | null;
        fallback_voice_message_repeat_count?: number;
        voice_message_flag_enabled?: boolean;
    };
}

export interface EligibleResponse {
    status: string;
    data: {
        users: EligibleUser[];
    };
}

export type TierScope = "line" | "default_fallback" | "admin_fallback";
