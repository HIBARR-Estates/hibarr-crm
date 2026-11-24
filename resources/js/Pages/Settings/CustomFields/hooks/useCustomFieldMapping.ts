import { Dispatch, SetStateAction, useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { MappingOptions, MappingReport, MappingTarget, SettingsField } from "../types";

interface Options {
    setFields: Dispatch<SetStateAction<SettingsField[]>>;
}

function buildPayload(sourceId: number, target: MappingTarget, options: MappingOptions) {
    return {
        source_id: sourceId,
        target_type: target.type,
        ...(target.type === "custom" ? { target_id: target.id } : { target_key: target.key }),
        ...options,
    };
}

/**
 * Map / migrate / delete for one custom field, wired to
 * CustomFieldMappingController (custom-fields.mapping.*). `preview` is a dry
 * run through the same code path as `apply`, so the numbers it shows are what
 * apply will do. A successful apply patches local field state (the source is
 * dropped when it was deleted) instead of reloading the page.
 */
export default function useCustomFieldMapping({ setFields }: Options) {
    const { t } = useTranslation();
    const { td } = useTd();
    const [previewing, setPreviewing] = useState(false);
    const [applying, setApplying] = useState(false);

    const errorMessage = useCallback(
        (error: any) => {
            const errors = error?.response?.data?.errors;
            const first = errors ? (Object.values(errors)[0] as string[])?.[0] : null;
            return first || error?.response?.data?.message || t("messages.somethingWentWrong");
        },
        [t],
    );

    const preview = useCallback(
        async (sourceId: number, target: MappingTarget, options: MappingOptions): Promise<MappingReport | null> => {
            setPreviewing(true);
            try {
                const res = await axios.post(route("custom-fields.mapping.preview"), buildPayload(sourceId, target, options), {
                    headers: { Accept: "application/json" },
                });
                return (res.data?.report as MappingReport) ?? null;
            } catch (error: any) {
                message.error(errorMessage(error));
                return null;
            } finally {
                setPreviewing(false);
            }
        },
        [errorMessage],
    );

    /** Returns the apply report, or the report attached to a refusal (so the dialog can show why), or null. */
    const apply = useCallback(
        async (
            sourceId: number,
            target: MappingTarget,
            options: MappingOptions,
        ): Promise<{ ok: boolean; report: MappingReport | null }> => {
            setApplying(true);
            try {
                const res = await axios.post(route("custom-fields.mapping.apply"), buildPayload(sourceId, target, options), {
                    headers: { Accept: "application/json" },
                });
                const report = (res.data?.report as MappingReport) ?? null;
                if (report?.deleted_field) {
                    setFields((prev) => prev.filter((f) => f.id !== sourceId));
                }
                // Options appended to a select/radio target change its definition.
                if (report && report.added_options.length > 0 && target.type === "custom") {
                    setFields((prev) =>
                        prev.map((f) =>
                            f.id === target.id
                                ? { ...f, values: [...f.values, ...report.added_options.filter((o) => !f.values.includes(o))] }
                                : f,
                        ),
                    );
                }
                message.success(td("Field mapping applied", { source: "en" }));
                return { ok: true, report };
            } catch (error: any) {
                message.error(errorMessage(error));
                return { ok: false, report: (error?.response?.data?.report as MappingReport) ?? null };
            } finally {
                setApplying(false);
            }
        },
        [errorMessage, setFields, td],
    );

    return { previewing, applying, preview, apply };
}
