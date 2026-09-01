import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import type {
    AgentOverride,
    PackageCommissionRow,
    PackageCommissionType,
} from "./types";

/**
 * Package commission mutations. Local state is the source of truth: each call
 * patches the row from the response rather than triggering an Inertia visit,
 * so editing a rate stays instant.
 */
export default function usePackageCommissions(initial: PackageCommissionRow[]) {
    const [packages, setPackages] = useState<PackageCommissionRow[]>(initial);
    const [overrides, setOverrides] = useState<Record<number, AgentOverride[]>>({});
    const [savingId, setSavingId] = useState<number | null>(null);

    const patchRow = useCallback((row: PackageCommissionRow) => {
        setPackages((prev) => prev.map((p) => (p.id === row.id ? row : p)));
    }, []);

    const savePackage = useCallback(
        async (
            id: number,
            commissionType: PackageCommissionType | null,
            commissionValue: number | null,
        ) => {
            setSavingId(id);
            try {
                const response = await axios.put(
                    route("package-commissions.api.packages.update", { package: id }),
                    {
                        commission_type: commissionType,
                        commission_value: commissionValue,
                    },
                );
                if (response.data?.data) patchRow(response.data.data);
                return true;
            } catch (error: any) {
                message.error(
                    error?.response?.data?.message ?? "Could not save the commission",
                );
                return false;
            } finally {
                setSavingId(null);
            }
        },
        [patchRow],
    );

    const loadOverrides = useCallback(async (packageId: number) => {
        try {
            const response = await axios.get(
                route("package-commissions.api.overrides.index", { package: packageId }),
            );
            setOverrides((prev) => ({ ...prev, [packageId]: response.data?.data ?? [] }));
        } catch {
            message.error("Could not load the agent overrides");
        }
    }, []);

    /** Keeps overrides_count on the row in step with the override list. */
    const applyOverrides = useCallback(
        (packageId: number, list: AgentOverride[]) => {
            setOverrides((prev) => ({ ...prev, [packageId]: list }));
            setPackages((prev) =>
                prev.map((p) =>
                    p.id === packageId ? { ...p, overrides_count: list.length } : p,
                ),
            );
        },
        [],
    );

    const saveOverride = useCallback(
        async (
            packageId: number,
            agentId: number,
            commissionType: PackageCommissionType,
            commissionValue: number,
        ) => {
            try {
                const response = await axios.put(
                    route("package-commissions.api.overrides.upsert", {
                        package: packageId,
                        agent: agentId,
                    }),
                    {
                        commission_type: commissionType,
                        commission_value: commissionValue,
                    },
                );
                applyOverrides(packageId, response.data?.data ?? []);
                return true;
            } catch (error: any) {
                message.error(
                    error?.response?.data?.message ?? "Could not save the override",
                );
                return false;
            }
        },
        [applyOverrides],
    );

    const removeOverride = useCallback(
        async (packageId: number, agentId: number) => {
            try {
                const response = await axios.delete(
                    route("package-commissions.api.overrides.destroy", {
                        package: packageId,
                        agent: agentId,
                    }),
                );
                applyOverrides(packageId, response.data?.data ?? []);
            } catch {
                message.error("Could not remove the override");
            }
        },
        [applyOverrides],
    );

    return {
        packages,
        overrides,
        savingId,
        savePackage,
        loadOverrides,
        saveOverride,
        removeOverride,
    };
}
