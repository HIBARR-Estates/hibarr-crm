/** The first validation message (or the message) of a failed axios request, else the fallback. */
export function firstErrorMessage(error: unknown, fallback: string): string {
    const data = (error as { response?: { data?: Record<string, unknown> } })
        ?.response?.data;
    const errors = data?.errors as Record<string, string[]> | undefined;
    if (errors) {
        const first = Object.values(errors).flat()[0];
        if (typeof first === "string" && first.length > 0) {
            return first;
        }
    }
    if (typeof data?.message === "string" && data.message.length > 0) {
        return data.message;
    }

    return fallback;
}
