/** Broadcast when the signed-in user's email unread count may have changed. */
export const EMAIL_UNREAD_CHANGED_EVENT = "hibarr:email-unread-changed";

export function notifyEmailUnreadChanged(unread?: number): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent(EMAIL_UNREAD_CHANGED_EVENT, {
            detail: { unread },
        }),
    );
}

export function subscribeEmailUnreadChanged(
    handler: (unread?: number) => void,
): () => void {
    if (typeof window === "undefined") return () => undefined;

    const listener = (event: Event) => {
        const unread = (event as CustomEvent<{ unread?: number }>).detail
            ?.unread;
        handler(typeof unread === "number" ? unread : undefined);
    };

    window.addEventListener(EMAIL_UNREAD_CHANGED_EVENT, listener);
    return () => window.removeEventListener(EMAIL_UNREAD_CHANGED_EVENT, listener);
}
