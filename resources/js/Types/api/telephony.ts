export type TelephonyEntityType = "lead" | "deal";

export interface TelephonyCallEntity {
    type: TelephonyEntityType;
    id: number;
}

export interface TelephonyCallRequest {
    phone: string;
    entity_type: TelephonyEntityType;
    entity_id: number;
}

export interface TelephonyCallResponse {
    status: "success" | "fail";
    message?: string;
    data?: Record<string, unknown>;
}
