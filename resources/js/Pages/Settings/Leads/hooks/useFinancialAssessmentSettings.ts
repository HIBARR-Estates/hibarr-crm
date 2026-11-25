import { useCallback, useState } from "react";
import axios from "axios";
import { App } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { firstErrorMessage } from "./apiErrors";
import type {
    FinancialAssessmentSettings,
    FinancialCertainty,
    FinancialCryptoAssetRow,
    FinancialFrequency,
    FinancialKindRole,
    FinancialKindRow,
    FinancialRateTestResult,
    FinancialTypeRow,
} from "../types";

type Saving = "kind" | "type" | "asset" | "defaults" | "test" | null;

/**
 * Owns the Financial assessments tab's data. The deferred Inertia payload only
 * seeds it; every mutation patches this local state from the response, so an
 * edit never reloads the page.
 */
export default function useFinancialAssessmentSettings(initial: FinancialAssessmentSettings) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [settings, setSettings] = useState<FinancialAssessmentSettings>(initial);
    const [saving, setSaving] = useState<Saving>(null);
    const [testResult, setTestResult] = useState<FinancialRateTestResult | null>(null);

    const run = useCallback(
        async <T,>(kind: Exclude<Saving, null>, request: () => Promise<{ data: Record<string, unknown> }>, apply: (data: T) => void): Promise<boolean> => {
            setSaving(kind);
            try {
                const res = await request();
                if (res.data?.status === "success") {
                    apply(res.data as T);
                    if (kind !== "test" && typeof res.data.message === "string" && res.data.message !== "") {
                        message.success(res.data.message);
                    }
                    return true;
                }
                message.error((res.data?.message as string) || t("messages.somethingWentWrong"));
                return false;
            } catch (error) {
                message.error(firstErrorMessage(error, t("messages.somethingWentWrong")));
                return false;
            } finally {
                setSaving(null);
            }
        },
        [message, t],
    );

    const headers = { headers: { Accept: "application/json" } };

    const patchKind = (kind: FinancialKindRow) =>
        setSettings((prev) => ({
            ...prev,
            kinds: prev.kinds.map((row) => (row.id === kind.id ? { ...kind, types: kind.types.length ? kind.types : row.types } : row)),
        }));

    const patchType = (type: FinancialTypeRow) =>
        setSettings((prev) => ({
            ...prev,
            kinds: prev.kinds.map((kind) =>
                kind.id === type.kind_id
                    ? {
                          ...kind,
                          types: kind.types.some((row) => row.id === type.id)
                              ? kind.types.map((row) => (row.id === type.id ? type : row))
                              : [...kind.types, type],
                      }
                    : kind,
            ),
        }));

    const createKind = useCallback(
        (label: string, role: FinancialKindRole) =>
            run<{ kind: FinancialKindRow }>(
                "kind",
                () => axios.post(route("settings-leads.financial.kinds.store"), { label, role }, headers),
                ({ kind }) => setSettings((prev) => ({ ...prev, kinds: [...prev.kinds, kind] })),
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [run],
    );

    const updateKind = useCallback(
        (id: number, changes: { label?: string; is_active?: boolean }) =>
            run<{ kind: FinancialKindRow }>(
                "kind",
                () => axios.put(route("settings-leads.financial.kinds.update", { kind: id }), changes, headers),
                ({ kind }) => patchKind(kind),
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [run],
    );

    const createType = useCallback(
        (kindId: number, label: string, frequency: FinancialFrequency | null, certainty: FinancialCertainty | null) =>
            run<{ type: FinancialTypeRow }>(
                "type",
                () =>
                    axios.post(
                        route("settings-leads.financial.types.store"),
                        { kind_id: kindId, label, default_frequency: frequency, default_certainty: certainty },
                        headers,
                    ),
                ({ type }) => patchType(type),
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [run],
    );

    const updateType = useCallback(
        (
            id: number,
            changes: {
                label?: string;
                default_frequency?: FinancialFrequency | null;
                default_certainty?: FinancialCertainty | null;
                is_active?: boolean;
            },
        ) =>
            run<{ type: FinancialTypeRow }>(
                "type",
                () => axios.put(route("settings-leads.financial.types.update", { type: id }), changes, headers),
                ({ type }) => patchType(type),
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [run],
    );

    const createAsset = useCallback(
        (ticker: string, providerId: string, name: string) =>
            run<{ asset: FinancialCryptoAssetRow }>(
                "asset",
                () =>
                    axios.post(
                        route("settings-leads.financial.crypto-assets.store"),
                        { ticker, provider_id: providerId, name },
                        headers,
                    ),
                ({ asset }) => setSettings((prev) => ({ ...prev, crypto_assets: [...prev.crypto_assets, asset].sort((a, b) => a.ticker.localeCompare(b.ticker)) })),
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [run],
    );

    const updateAsset = useCallback(
        (id: number, changes: { provider_id?: string; name?: string; is_active?: boolean }) =>
            run<{ asset: FinancialCryptoAssetRow }>(
                "asset",
                () => axios.put(route("settings-leads.financial.crypto-assets.update", { asset: id }), changes, headers),
                ({ asset }) =>
                    setSettings((prev) => ({
                        ...prev,
                        crypto_assets: prev.crypto_assets.map((row) => (row.id === asset.id ? asset : row)),
                    })),
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [run],
    );

    const saveDefaults = useCallback(
        (reportingCurrency: string, refreshAfterDays: number) =>
            run<{ defaults: { reporting_currency: string; refresh_after_days: number } }>(
                "defaults",
                () =>
                    axios.put(
                        route("settings-leads.financial.defaults.update"),
                        { reporting_currency: reportingCurrency, refresh_after_days: refreshAfterDays },
                        headers,
                    ),
                ({ defaults }) => setSettings((prev) => ({ ...prev, defaults: { ...prev.defaults, ...defaults } })),
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [run],
    );

    const testRates = useCallback(
        () =>
            run<{ result: FinancialRateTestResult }>(
                "test",
                () => axios.post(route("settings-leads.financial.crypto-assets.test"), {}, headers),
                ({ result }) => setTestResult(result),
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [run],
    );

    return {
        settings,
        saving,
        testResult,
        createKind,
        updateKind,
        createType,
        updateType,
        createAsset,
        updateAsset,
        saveDefaults,
        testRates,
    };
}
