import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import type { Deal } from "@/Types/api/deals";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

/**
 * Attach/detach packages on a deal via the same inline-update contract the Deal
 * Info tab's package field uses (`deals.gathering.inline_update`, type "details",
 * field `package_id`). Lets the Dossier add a package inline.
 */
export default function useDealPackages(deal: Deal) {
    const [saving, setSaving] = useState(false);
    const { setDeal } = useDealWorkspace();

    const currentIds = useCallback(
        () => (deal.packages ?? []).map((pkg) => pkg.id),
        [deal.packages],
    );

    const save = useCallback(
        async (nextIds: number[]) => {
            setSaving(true);
            try {
                const response = await axios.patch(
                    route("deals.gathering.inline_update", { id: deal.id }),
                    { type: "details", data: { package_id: nextIds } },
                );
                if (response.data?.status === "success" && response.data?.data) {
                    setDeal(response.data.data);
                }
            } catch {
                message.error("Failed to update packages");
            } finally {
                setSaving(false);
            }
        },
        [deal.id, setDeal],
    );

    const addPackage = useCallback(
        (id: number) => {
            if (currentIds().includes(id)) return;
            void save([...currentIds(), id]);
        },
        [currentIds, save],
    );

    const removePackage = useCallback(
        (id: number) => {
            void save(currentIds().filter((pkgId) => pkgId !== id));
        },
        [currentIds, save],
    );

    return { addPackage, removePackage, saving };
}
