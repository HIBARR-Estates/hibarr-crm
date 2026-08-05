import { useRef } from "react";
import axios, { AxiosRequestConfig, AxiosError } from "axios";
import {
    useMutation,
    useQueryClient,
    type MutateOptions,
    type UseMutationResult,
} from "@tanstack/react-query";
import { AuthType } from "@/Types";
import { usePage } from "@inertiajs/react";
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

/** Extra per-call options for useApiMutate (stripped before TanStack mutate). */
export type ApiMutateCallOptions = {
    /**
     * Skip automatic success toasts for this call only.
     * Error notifications still fire. Call-site can show a combined message later.
     */
    suppressSuccessToast?: boolean;
};

const createData = async <
    Payload,
    T,
    MutationResponse extends ApiResponse<T>,
    Params = undefined
>(props: {
    data: Payload;
    params?: Params;
    path: string;
    auth?: AuthType;
    method: AllowedHttpMethod;
    isFormData?: boolean;
}): Promise<MutationResponse> => {
    const { method, auth, data, path, params, isFormData = false } = props;
    const url = `${path}`;
    const config: AxiosRequestConfig = {
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-COMPANY-ID": auth?.user.company_id || "",
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
        if (isFormData) {
            config.headers = {
                ...config.headers,
                Accept: "multipart/form-data",

                "Content-Type": "multipart/form-data",
            };

            const formData = new FormData();
            if (data && typeof data === "object") {
                Object.entries(data).forEach(([key, value]) => {
                    if (value === null || value === undefined) return;
                    if (Array.isArray(value)) {
                        value.forEach((item) =>
                            formData.append(`${key}[]`, item as string | Blob),
                        );
                        return;
                    }
                    formData.append(key, value as string | Blob);
                });
            }

            config.data = formData;
        }
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

export type UseApiMutateResult<
    Payload,
    T,
    MutationResponse extends ApiResponse<T>
> = Omit<
    UseMutationResult<MutationResponse, unknown, Payload, unknown>,
    "mutate" | "mutateAsync"
> & {
    mutate: (
        variables: Payload,
        options?: MutateOptions<MutationResponse, unknown, Payload, unknown> &
            ApiMutateCallOptions
    ) => void;
    mutateAsync: (
        variables: Payload,
        options?: MutateOptions<MutationResponse, unknown, Payload, unknown> &
            ApiMutateCallOptions
    ) => Promise<MutationResponse>;
};

export const useApiMutate = <
    Payload,
    T,
    MutationResponse extends ApiResponse<T>,
    Params = undefined
>(
    path: string,
    method: AllowedHttpMethod,
    callbackFn?: (res?: MutationResponse) => void,
    isFormData?: boolean
): UseApiMutateResult<Payload, T, MutationResponse> => {
    const { props } = usePage();
    const { auth } = props;

    const queryClient = useQueryClient();
    const { notification, message } = App.useApp();
    const suppressSuccessToastRef = useRef(false);

    const mutation = useMutation({
        mutationKey: [path, method],
        mutationFn: (payload: Payload) => {
            return createData<Payload, T, MutationResponse, Params>({
                data: payload,
                path,
                auth,
                method,
                isFormData,
            });
        },
        onSuccess: (response, _, _context) => {
            // Handle different response types using type guards
            if (isSuccessResponse(response)) {
                // Show success message if provided (unless this call opted out)
                if (response.message && !suppressSuccessToastRef.current) {
                    message.success(response.message);
                }

                // Invalidate queries on success
                invalidateOnSuccess(queryClient, path);

                // Execute callback
                callbackFn?.(response);
            } else if (isRedirectResponse(response)) {
                // Handle redirect responses
                if (response.message && !suppressSuccessToastRef.current) {
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
                    message:
                        apiError?.message ||
                        "An unexpected error occurred! Please try again.",
                    description: apiError?.status || "",
                    duration: 5,
                });
            }
        },
    });

    const mutate: UseApiMutateResult<
        Payload,
        T,
        MutationResponse
    >["mutate"] = (variables, options) => {
        const { suppressSuccessToast, ...mutateOptions } = options ?? {};
        suppressSuccessToastRef.current = Boolean(suppressSuccessToast);
        mutation.mutate(variables, {
            ...mutateOptions,
            onSettled: (data, error, vars, onMutateResult, context) => {
                suppressSuccessToastRef.current = false;
                mutateOptions.onSettled?.(
                    data,
                    error,
                    vars,
                    onMutateResult,
                    context,
                );
            },
        });
    };

    const mutateAsync: UseApiMutateResult<
        Payload,
        T,
        MutationResponse
    >["mutateAsync"] = (variables, options) => {
        const { suppressSuccessToast, ...mutateOptions } = options ?? {};
        suppressSuccessToastRef.current = Boolean(suppressSuccessToast);
        return mutation
            .mutateAsync(variables, {
                ...mutateOptions,
                onSettled: (data, error, vars, onMutateResult, context) => {
                    suppressSuccessToastRef.current = false;
                    mutateOptions.onSettled?.(
                        data,
                        error,
                        vars,
                        onMutateResult,
                        context,
                    );
                },
            })
            .finally(() => {
                suppressSuccessToastRef.current = false;
            });
    };

    return {
        ...mutation,
        mutate,
        mutateAsync,
    };
};
