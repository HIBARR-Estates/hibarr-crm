import {
    ApiResponse,
    ApiErrorResponse,
    ApiFormErrorResponse,
    isErrorResponse,
    isFormErrorResponse,
} from "../types";

// Standard error format for consistent error handling across the app
export interface FormattedError {
    message: string;
    errors?: Record<string, string[]>;
}

/**
 * Error formatter that converts error responses into standard structure
 * Takes in an unknown error response and returns the formatted error object
 * @param error - Unknown error response from API or network
 * @returns FormattedError - Standardized error object with message and optional field errors
 */
export const errorFormatter = (error: unknown): FormattedError => {
    console.log(error, "why occur ....");
    // Default fallback error
    const defaultError: FormattedError = {
        message: "An unexpected error occurred. Please try again.",
        errors: undefined,
    };

    // Handle null/undefined errors
    if (!error) {
        return defaultError;
    }

    // Handle string errors
    if (typeof error === "string") {
        return {
            message: error,
            errors: undefined,
        };
    }

    // Handle Error objects
    if (error instanceof Error) {
        return {
            message: error.message || defaultError.message,
            errors: undefined,
        };
    }

    // Handle ApiResponse types
    if (typeof error === "object" && error !== null) {
        const apiError = error as ApiResponse<any>;

        // Handle form validation errors
        if (isFormErrorResponse(apiError)) {
            return {
                message: "Please fix the validation errors below",
                errors: apiError.errors,
            };
        }

        // Handle general API errors
        if (isErrorResponse(apiError)) {
            return {
                message: apiError.message,
                errors: undefined,
            };
        }

        // Handle objects with message property
        if ("message" in apiError && typeof apiError.message === "string") {
            return {
                message: apiError.message,
                errors: undefined,
            };
        }

        // Handle axios error structure
        if ("response" in apiError && apiError.response) {
            const response = (apiError as any).response;

            // Extract data from axios response
            if (response.data) {
                return errorFormatter(response.data);
            }

            // Use status text as fallback
            if (response.statusText) {
                return {
                    message: response.statusText,
                    errors: undefined,
                };
            }
        }

        // Handle network errors
        if ("code" in apiError && apiError.code === "NETWORK_ERROR") {
            return {
                message:
                    "Network error. Please check your connection and try again.",
                errors: undefined,
            };
        }

        // Handle timeout errors
        if ("code" in apiError && apiError.code === "ECONNABORTED") {
            return {
                message: "Request timed out. Please try again.",
                errors: undefined,
            };
        }
    }

    // Return default error for unhandled cases
    return defaultError;
};

/**
 * Helper function to get just the error message from any error
 * @param error - Unknown error
 * @returns string - Error message
 */
export const getErrorMessage = (error: unknown): string => {
    return errorFormatter(error).message;
};

/**
 * Helper function to check if error has validation errors
 * @param error - Unknown error
 * @returns boolean - True if error has field validation errors
 */
export const hasValidationErrors = (error: unknown): boolean => {
    const formatted = errorFormatter(error);
    return !!(formatted.errors && Object.keys(formatted.errors).length > 0);
};

/**
 * Helper function to get validation errors for a specific field
 * @param error - Unknown error
 * @param fieldName - Field name to get errors for
 * @returns string[] - Array of error messages for the field
 */
export const getFieldErrors = (error: unknown, fieldName: string): string[] => {
    const formatted = errorFormatter(error);
    return formatted.errors?.[fieldName] || [];
};

/**
 * Helper function to get the first error message for a field
 * @param error - Unknown error
 * @param fieldName - Field name to get error for
 * @returns string | undefined - First error message for the field
 */
export const getFirstFieldError = (
    error: unknown,
    fieldName: string
): string | undefined => {
    const fieldErrors = getFieldErrors(error, fieldName);
    return fieldErrors.length > 0 ? fieldErrors[0] : undefined;
};
