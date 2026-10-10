import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { usePage } from "@inertiajs/react";
import {
    subscribeEmailUnreadChanged,
} from "@/Email/emailUnreadEvents";

/**
 * Mailbox-owner unread count (inbound copies in own mailboxes). Independent of
 * Lead Owner — two recipients each get their own indicator.
 */
export default function useEmailUnreadCount(options?: {
    /** Poll interval ms; 0 disables polling after the first fetch. */
    pollingInterval?: number;
    enabled?: boolean;
}) {
    const { props } = usePage();
    const flagOn = props.featureFlags?.["crm.email"] === true;
    const enabled = (options?.enabled ?? true) && flagOn;
    const pollingInterval = options?.pollingInterval ?? 60_000;

    const [unread, setUnread] = useState(0);
    const [available, setAvailable] = useState(false);

    const refresh = useCallback(async () => {
        if (!enabled) {
            setUnread(0);
            setAvailable(false);
            return;
        }

        try {
            const response = await axios.get<{ unread: number }>("/email/unread");
            const count = Number(response.data.unread) || 0;
            setUnread(count);
            setAvailable(true);
        } catch {
            // Flag off / not allowlisted / network — hide the indicator.
            setUnread(0);
            setAvailable(false);
        }
    }, [enabled]);

    useEffect(() => {
        if (!enabled) {
            setUnread(0);
            setAvailable(false);
            return;
        }

        void refresh();

        if (pollingInterval <= 0) {
            return subscribeEmailUnreadChanged((next) => {
                if (typeof next === "number") {
                    setUnread(next);
                    setAvailable(true);
                } else {
                    void refresh();
                }
            });
        }

        const timer = window.setInterval(() => {
            void refresh();
        }, pollingInterval);

        const unsubscribe = subscribeEmailUnreadChanged((next) => {
            if (typeof next === "number") {
                setUnread(next);
                setAvailable(true);
            } else {
                void refresh();
            }
        });

        return () => {
            window.clearInterval(timer);
            unsubscribe();
        };
    }, [enabled, pollingInterval, refresh]);

    return {
        unread,
        available,
        refresh,
    };
}
