import axios, { AxiosRequestConfig, AxiosError } from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthType } from "@/Types";
import { router, usePage } from "@inertiajs/react";
import {
    ApiErrorResponse,
    ApiResponse,
    ApiFormErrorResponse,
    isSuccessResponse,
    isErrorResponse,
    isFormErrorResponse,
    isRedirectResponse,
} from "../types";
import { App } from "antd";
import { invalidateOnSuccess } from "../utils";

type AllowedHttpMethod = "PATCH" | "DELETE" | "PUT" | "POST";

const createFormData = async <
    T,
    MutationResponse extends ApiResponse<T>,
    Params = undefined
>(props: {
    data: FormData;
    params?: Params;
    path: string;
    auth?: AuthType;
    method: AllowedHttpMethod;
}): Promise<MutationResponse> => {
    const { method, auth, data, path, params } = props;
    const url = `${path}`;
    const config: AxiosRequestConfig = {
        headers: {
            Accept: "application/json",
            "Content-Type": "multipart/form-data",
            // Add auth headers if needed
            // Authorization: `Bearer ${auth?.accessToken}`,
            // "x-institution-id": auth?.institutionId,
        },
        method,
        params,
        data,
        url,
    };

    try {
        const response = await axios.request<MutationResponse>(config);
        return response.data;
    } catch (error) {
        // Handle axios errors and convert to our ApiResponse format
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<ApiResponse<any>>;
            if (axiosError.response?.data) {
                throw axiosError.response.data;
            }
        }
        // Fallback error response
        throw {
            status: "fail",
            message: "An unexpected error occurred",
            error_name: "network_error",
        } as ApiErrorResponse;
    }
};

export const useFormDataMutate = <
    T,
    MutationResponse extends ApiResponse<T>,
    Params = undefined
>(
    path: string,
    method: AllowedHttpMethod,
    callbackFn?: (res?: MutationResponse) => void
) => {
    const { props } = usePage();
    const { auth } = props;

    const queryClient = useQueryClient();
    const { notification, message } = App.useApp();

    return useMutation({
        mutationKey: [path, method],
        mutationFn: (payload: FormData) => {
            return createFormData<T, MutationResponse, Params>({
                data: payload,
                path,
                auth,
                method,
            });
        },
        onSuccess: (response, _, _context) => {
            // Handle different response types using type guards
            if (isSuccessResponse(response)) {
                // Show success message if provided
                if (response.message) {
                    message.success(response.message);
                }

                // Invalidate queries on success
                invalidateOnSuccess(queryClient, path);

                // Execute callback
                callbackFn?.(response);
            } else if (isRedirectResponse(response)) {
                // Handle redirect responses
                if (response.message) {
                    message.success(response.message);
                }

                // Perform redirect (you might want to use Inertia's router here)
                window.location.href = response.url;
            } else if (isFormErrorResponse(response)) {
                // Handle form validation errors
                notification.error({
                    message: "Validation Error",
                    description: "Please check the form for errors",
                    duration: 5,
                });

                // You might want to handle form errors differently
                // For example, set form field errors
                callbackFn?.(response);
            } else if (isErrorResponse(response)) {
                // Handle general errors
                notification.error({
                    message: response.error_name || "Error",
                    description: response.message,
                    duration: 5,
                });

                callbackFn?.(response);
            }
        },
        onError: (error) => {
            // Handle thrown errors (network errors, parsing errors, etc.)
            const apiError = error as unknown as ApiResponse<any>;

            if (isFormErrorResponse(apiError)) {
                notification.error({
                    message: "Validation Error",
                    description: "Please check the form for errors",
                    duration: 5,
                });
            } else if (isErrorResponse(apiError)) {
                notification.error({
                    message: apiError.error_name || "Error",
                    description: apiError.message,
                    duration: 5,
                });
            } else {
                // Fallback for unknown errors
                notification.error({
                    message: "Error",
                    description:
                        "An unexpected error occurred. Please try again.",
                    duration: 5,
                });
            }
        },
    });
};
