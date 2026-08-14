import React, { useEffect, useMemo, useState } from "react";
import { Checkbox, Radio, message } from "antd";
import type { IModalProps } from "@/Types/common";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { getCurrentQueryParams } from "@/lib/inertiaQuery";
import { fmt } from "@/Features/Leads/Filters/controls";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import RedesignButton from "@/Components/Redesign/primitives/Button";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { LeadBulkTarget } from "./bulkTarget";
import { buildBulkTargetPayload } from "./bulkTarget";
import {
    defaultExportFieldKeys,
    exportFieldGroups,
    type LeadExportFormat,
} from "./exportFieldConfig";

interface Props extends IModalProps {
    target: LeadBulkTarget;
}

function appendHidden(
    form: HTMLFormElement,
    name: string,
    value: string | number | boolean,
) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
}

const BulkExportLeads: React.FC<Props> = ({ open, onClose, target }) => {
    const { td } = useTd();
    const groups = useMemo(() => exportFieldGroups(), []);
    const [selectedKeys, setSelectedKeys] = useState<string[]>(() =>
        defaultExportFieldKeys(),
    );
    const [format, setFormat] = useState<LeadExportFormat>("xlsx");
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        if (!open) {
            return;
        }
        setSelectedKeys(defaultExportFieldKeys());
        setFormat("xlsx");
        setExporting(false);
    }, [open]);

    const allKeys = useMemo(
        () => groups.flatMap((g) => g.fields.map((f) => f.key)),
        [groups],
    );

    const handleSelectAll = () => setSelectedKeys(allKeys);
    const handleResetDefaults = () => setSelectedKeys(defaultExportFieldKeys());

    const toggleKey = (key: string, checked: boolean) => {
        setSelectedKeys((prev) => {
            if (checked) {
                return prev.includes(key) ? prev : [...prev, key];
            }
            return prev.filter((k) => k !== key);
        });
    };

    const handleExport = () => {
        if (selectedKeys.length === 0) {
            message.error(
                td("Select at least one field to export.", { source: "en" }),
            );
            return;
        }

        setExporting(true);

        const form = document.createElement("form");
        form.method = "POST";
        form.action = route("lead-contact.export");
        form.style.display = "none";

        const csrfToken = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content");
        if (csrfToken) {
            appendHidden(form, "_token", csrfToken);
        }

        const payload: Record<string, unknown> = {
            ...buildBulkTargetPayload(target),
            ...getCurrentQueryParams(),
            format,
        };
        delete payload.page;
        delete payload.per_page;

        Object.entries(payload).forEach(([key, value]) => {
            if (value === undefined || value === null || value === "") {
                return;
            }
            if (Array.isArray(value)) {
                value.forEach((item) => appendHidden(form, `${key}[]`, item));
                return;
            }
            appendHidden(form, key, value as string | number | boolean);
        });

        // Preserve picker order (LEAD_EXPORT_FIELDS order among selected).
        const ordered = allKeys.filter((key) => selectedKeys.includes(key));
        ordered.forEach((key) => appendHidden(form, "fields[]", key));

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);

        setTimeout(() => {
            setExporting(false);
            onClose?.(false);
            message.success(
                td("Export started successfully", { source: "en" }),
            );
        }, 1000);
    };

    const countLabel = fmt(target.count);
    const subtitle =
        target.mode === "all_matching"
            ? td(
                  `Export all ${countLabel} leads matching the current filters.`,
                  { source: "en" },
              )
            : td(`Export ${countLabel} selected leads.`, { source: "en" });

    return (
        <Modal
            open={open}
            onClose={() => onClose?.(false)}
            title={td("Export leads", { source: "en" })}
            maxWidth={640}
            footer={
                <>
                    <RedesignButton
                        variant="ghost"
                        onClick={() => onClose?.(false)}
                        disabled={exporting}
                    >
                        {td("Cancel", { source: "en" })}
                    </RedesignButton>
                    <RedesignButton
                        variant="primary"
                        loading={exporting}
                        disabled={selectedKeys.length === 0}
                        onClick={handleExport}
                    >
                        {td("Export", { source: "en" })}
                    </RedesignButton>
                </>
            }
        >
            <p className="text-sm mb-4" style={{ color: T.TEXT_MUTED }}>
                {subtitle}
            </p>

            <div className="mb-4">
                <div className="dr-label mb-2">{td("Format", { source: "en" })}</div>
                <Radio.Group
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                    options={[
                        { label: "XLSX", value: "xlsx" },
                        { label: "CSV", value: "csv" },
                    ]}
                />
            </div>

            <div className="flex items-center justify-between gap-2 mb-3">
                <div className="dr-label">
                    {td("Fields", { source: "en" })} ({selectedKeys.length}/
                    {allKeys.length})
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        className="dr-btn dr-btn-ghost dr-btn-sm"
                        onClick={handleSelectAll}
                    >
                        {td("Select all", { source: "en" })}
                    </button>
                    <button
                        type="button"
                        className="dr-btn dr-btn-ghost dr-btn-sm"
                        onClick={handleResetDefaults}
                    >
                        {td("Reset defaults", { source: "en" })}
                    </button>
                </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto space-y-4 pr-1">
                {groups.map(({ group, fields }) => (
                    <div key={group}>
                        <div
                            className="text-sm font-semibold mb-2"
                            style={{ color: T.TEXT }}
                        >
                            {td(group, { source: "en" })}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                            {fields.map((field) => (
                                <Checkbox
                                    key={field.key}
                                    checked={selectedKeys.includes(field.key)}
                                    onChange={(e) =>
                                        toggleKey(field.key, e.target.checked)
                                    }
                                >
                                    {td(field.label, { source: "en" })}
                                </Checkbox>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
};

export default BulkExportLeads;
