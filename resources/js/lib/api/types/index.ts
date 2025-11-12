// Base API Response structure
export interface BaseApiResponse {
    status: "success" | "fail";
    message?: string;
}

// Success response with data
export interface ApiSuccessResponse<T = any> extends BaseApiResponse {
    status: "success";
    message: string;
    data?: T;
}

// Error response
export interface ApiErrorResponse extends BaseApiResponse {
    status: "fail";
    message: string;
    error_name?: string;
    data?: any;
}

// Form validation error response
export interface ApiFormErrorResponse extends BaseApiResponse {
    status: "fail";
    errors: Record<string, string[]>;
}

// Redirect response
export interface ApiRedirectResponse extends BaseApiResponse {
    status: "success";
    message?: string;
    action: "redirect";
    url: string;
}

// Union type for all possible API responses
export type ApiResponse<T = any> =
    | ApiSuccessResponse<T>
    | ApiErrorResponse
    | ApiFormErrorResponse
    | ApiRedirectResponse;

// Type guards for response checking
export const isSuccessResponse = <T>(
    response: ApiResponse<T>
): response is ApiSuccessResponse<T> => {
    return response.status === "success" && !("action" in response);
};

export const isErrorResponse = (
    response: ApiResponse
): response is ApiErrorResponse => {
    return (
        response.status === "fail" &&
        "message" in response &&
        !("errors" in response)
    );
};

export const isFormErrorResponse = (
    response: ApiResponse
): response is ApiFormErrorResponse => {
    return (
        Boolean(response.status === "fail" && "errors" in response) ||
        Boolean(response?.message && "errors" in response)
    );
};

export const isRedirectResponse = (
    response: ApiResponse
): response is ApiRedirectResponse => {
    return (
        response.status === "success" &&
        "action" in response &&
        response.action === "redirect"
    );
};

// Generic API Response for paginated data
export interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
    next_page_url?: string;
    prev_page_url?: string;
}

export interface ApiPaginatedResponse<T>
    extends ApiSuccessResponse<PaginatedResponse<T>> {
    data: PaginatedResponse<T>;
}
