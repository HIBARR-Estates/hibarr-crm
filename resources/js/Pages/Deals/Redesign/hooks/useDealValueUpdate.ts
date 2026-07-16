import { router } from "@inertiajs/react";
import { message } from "antd";
import { useCallback, useState } from "react";
import { Deal } from "@/Types/api/deals";

export default function useDealValueUpdate(deal: Deal, canEdit: boolean) {
    const [isUpdating, setIsUpdating] = useState(false);

    const update = useCallback(
        (payload: { value_source?: "manual" | "calculated"; manual_value?: number }) => {
            if (!canEdit || isUpdating) return;
            setIsUpdating(true);
            router.put(route("deals.update", deal.id), payload, {
                preserveScroll: true,
                preserveState: true,
                onError: () => message.error("Failed to update deal value"),
                onFinish: () => setIsUpdating(false),
            });
        },
        [canEdit, deal.id, isUpdating],
    );

    return { isUpdating, update };
}
