import axios from "axios";

/** The message a failed request carries, or the fallback. */
export function errorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
        if (typeof data?.message === "string" && data.message !== "") return data.message;
        const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
        if (typeof first === "string" && first !== "") return first;
    }
    if (error instanceof Error && error.message !== "") return error.message;
    return fallback;
}
