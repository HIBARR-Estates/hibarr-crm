import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import type {
    AgentOverride,
    PackageFormValues,
    PackageRow,
    PackageCommissionType,
    RoutingFieldOption,
    RoutingTrigger,
} from "./types";

/**
 * Package settings mutations.
 *
 * Local state is the source of truth: every call patches the affected row from
 * the response instead of triggering an Inertia visit, so edits stay instant.
 */
export default function usePackages(initial: PackageRow[]) {
    const [packages, setPackages] = useState<PackageRow[]>(initial);
    const [overrides, setOverrides] = useState<Record<number, AgentOverride[]>>({});
    const [saving, setSaving] = useState(false);

    const sortByName = (rows: PackageRow[]) =>
        [...rows].sort((a, b) => a.name.localeCompare(b.name));

    const patchRow = useCallback((row: PackageRow) => {
        setPackages((prev) =>
            sortByName(
                prev.some((p) => p.id === row.id)
                    ? prev.map((p) => (p.id === row.id ? row : p))
                    : [...prev, row],
            ),
        );
    }, []);

    /** Surfaces the first validation message when there is one, else a fallback. */
    const fail = (error: any, fallback: string) => {
        const errors = error?.response?.data?.errors as
            | Record<string, string[]>
            | undefined;
        const firstFieldError = errors ? Object.values(errors)[0]?.[0] : undefined;

        message.error(
            firstFieldError ?? error?.response?.data?.message ?? fallback,
        );
    };

    const createPackage = useCallback(
        async (values: PackageFormValues) => {
            setSaving(true);
            try {
                const response = await axios.post(
                    route("package-settings.api.packages.store"),
                    values,
                );
                if (response.data?.data) patchRow(response.data.data);
                message.success(response.data?.message ?? "Package created");
                return true;
            } catch (error) {
                fail(error, "Could not create the package");
                return false;
            } finally {
                setSaving(false);
            }
        },
        [patchRow],
    );

    const updatePackage = useCallback(
        async (id: number, values: Partial<PackageFormValues>) => {
            setSaving(true);
            try {
                const response = await axios.put(
                    route("package-settings.api.packages.update", { package: id }),
                    values,
                );
                if (response.data?.data) patchRow(response.data.data);
                message.success(response.data?.message ?? "Package saved");
                return true;
            } catch (error) {
                fail(error, "Could not save the package");
                return false;
            } finally {
                setSaving(false);
            }
        },
        [patchRow],
    );

    const deletePackage = useCallback(async (id: number) => {
        setSaving(true);
        try {
            await axios.delete(
                route("package-settings.api.packages.destroy", { package: id }),
            );
            setPackages((prev) => prev.filter((p) => p.id !== id));
            return true;
        } catch (error) {
            fail(error, "Could not delete the package");
            return false;
        } finally {
            setSaving(false);
        }
    }, []);

    const loadOverrides = useCallback(async (packageId: number) => {
        try {
            const response = await axios.get(
                route("package-settings.api.overrides.index", { package: packageId }),
            );
            setOverrides((prev) => ({ ...prev, [packageId]: response.data?.data ?? [] }));
        } catch {
            message.error("Could not load the agent overrides");
        }
    }, []);

    /** Keeps overrides_count on the row in step with the override list. */
    const applyOverrides = useCallback((packageId: number, list: AgentOverride[]) => {
        setOverrides((prev) => ({ ...prev, [packageId]: list }));
        setPackages((prev) =>
            prev.map((p) =>
                p.id === packageId ? { ...p, overrides_count: list.length } : p,
            ),
        );
    }, []);

    const saveOverride = useCallback(
        async (
            packageId: number,
            agentId: number,
            commissionType: PackageCommissionType,
            /** Null for "none" — there is nothing to enter. */
            commissionValue: number | null,
        ) => {
            try {
                const response = await axios.put(
                    route("package-settings.api.overrides.upsert", {
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
            } catch (error) {
                fail(error, "Could not save the override");
                return false;
            }
        },
        [applyOverrides],
    );

    const removeOverride = useCallback(
        async (packageId: number, agentId: number) => {
            try {
                const response = await axios.delete(
                    route("package-settings.api.overrides.destroy", {
                        package: packageId,
                        agent: agentId,
                    }),
                );
                applyOverrides(packageId, response.data?.data ?? []);
            } catch (error) {
                fail(error, "Could not remove the override");
            }
        },
        [applyOverrides],
    );

    /**
     * Fetched fresh each time the edit dialog opens for a package, rather than
     * cached like overrides — the picklist can include a one-off "stale field"
     * entry specific to that package's currently saved triggers.
     */
    const loadRoutingTriggers = useCallback(
        async (
            packageId: number,
        ): Promise<{ triggers: RoutingTrigger[]; fieldItems: RoutingFieldOption[] }> => {
            try {
                const response = await axios.get(
                    route("package-settings.api.routing_triggers.index", {
                        package: packageId,
                    }),
                );
                return {
                    triggers: response.data?.data?.triggers ?? [],
                    fieldItems: response.data?.data?.field_items ?? [],
                };
            } catch {
                message.error("Could not load the routing triggers");
                return { triggers: [], fieldItems: [] };
            }
        },
        [],
    );

    return {
        packages,
        overrides,
        saving,
        createPackage,
        updatePackage,
        deletePackage,
        loadOverrides,
        saveOverride,
        removeOverride,
        loadRoutingTriggers,
    };
}
