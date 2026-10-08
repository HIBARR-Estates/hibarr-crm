/** Custom event so task/note/meeting detail UIs can open the record email drawer. */
export const OPEN_SOURCE_EMAIL_EVENT = "hibarr:open-email-message";

export function openSourceEmailMessage(messageId: string): void {
    if (typeof window === "undefined" || !messageId) return;
    window.dispatchEvent(
        new CustomEvent(OPEN_SOURCE_EMAIL_EVENT, {
            detail: { messageId },
        }),
    );
}

export function subscribeOpenSourceEmail(
    handler: (messageId: string) => void,
): () => void {
    if (typeof window === "undefined") return () => undefined;

    const listener = (event: Event) => {
        const messageId = (event as CustomEvent<{ messageId?: string }>).detail
            ?.messageId;
        if (typeof messageId === "string" && messageId) {
            handler(messageId);
        }
    };

    window.addEventListener(OPEN_SOURCE_EMAIL_EVENT, listener);
    return () => window.removeEventListener(OPEN_SOURCE_EMAIL_EVENT, listener);
}
