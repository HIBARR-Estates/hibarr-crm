import { useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Select } from "antd";
import { PROJECT_CONSTRUCTION_STATUSES } from "@/Features/Properties/SaveProperty/constructionProjectConfig";
import { formatLocationNameForDisplay, snakeToReadable } from "@/lib/utils";
import { useTd } from "@/Hooks/useDynamicTranslation";

export interface ProjectsFilterDraft {
    developer_id: string;
    city: string;
    area: string;
    construction_status: string;
    primary_category: string;
    payment_plan_duration: string;
    price_min: string;
    price_max: string;
}

export const EMPTY_PROJECTS_FILTER_DRAFT: ProjectsFilterDraft = {
    developer_id: "",
    city: "",
    area: "",
    construction_status: "",
    primary_category: "",
    payment_plan_duration: "",
    price_min: "",
    price_max: "",
};

interface LookupOption {
    name: string;
    label: string;
}

interface FilterLocation {
    id: number;
    name: string;
    city?: string | null;
    area?: string | null;
}

interface ProjectsFiltersModalProps {
    open: boolean;
    onClose: () => void;
    onApply: (draft: ProjectsFilterDraft) => void;
    onReset: () => void;
    initialValues: ProjectsFilterDraft;
    developers: Array<{ id: number; name: string }>;
    locations: FilterLocation[];
    primaryCategories: LookupOption[];
}

function displayLabel(value: string): string {
    return formatLocationNameForDisplay(value) || snakeToReadable(value) || value;
}

const ProjectsFiltersModal = ({
    open,
    onClose,
    onApply,
    onReset,
    initialValues,
    developers,
    locations,
    primaryCategories,
}: ProjectsFiltersModalProps) => {
    const { td } = useTd();
    const [draft, setDraft] = useState<ProjectsFilterDraft>(initialValues);

    useEffect(() => {
        if (open) {
            setDraft(initialValues);
        }
    }, [open, initialValues]);

    const cityOptions = useMemo(() => {
        const seen = new Map<string, string>();
        for (const loc of locations) {
            const raw = loc.city?.trim();
            if (!raw) continue;
            const key = raw.toLowerCase();
            if (!seen.has(key)) {
                seen.set(key, raw);
            }
        }
        return Array.from(seen.values())
            .sort((a, b) => displayLabel(a).localeCompare(displayLabel(b)))
            .map((raw) => ({
                value: raw,
                label: displayLabel(raw),
            }));
    }, [locations]);

    const areaOptions = useMemo(() => {
        if (!draft.city) return [];
        const cityKey = draft.city.toLowerCase();
        const seen = new Map<string, string>();
        for (const loc of locations) {
            if ((loc.city ?? "").trim().toLowerCase() !== cityKey) continue;
            const raw = loc.area?.trim();
            if (!raw) continue;
            const key = raw.toLowerCase();
            if (!seen.has(key)) {
                seen.set(key, raw);
            }
        }
        return Array.from(seen.values())
            .sort((a, b) => displayLabel(a).localeCompare(displayLabel(b)))
            .map((raw) => ({
                value: raw,
                label: displayLabel(raw),
            }));
    }, [locations, draft.city]);

    const update = <K extends keyof ProjectsFilterDraft>(
        key: K,
        value: ProjectsFilterDraft[K],
    ) => {
        setDraft((prev) => {
            const next = { ...prev, [key]: value };
            if (key === "city") {
                next.area = "";
            }
            return next;
        });
    };

    return (
        <Modal
            title={td("Filters", { source: "en" })}
            open={open}
            onCancel={onClose}
            width={440}
            destroyOnClose
            footer={
                <div className="flex items-center justify-between">
                    <Button
                        onClick={() => {
                            setDraft(EMPTY_PROJECTS_FILTER_DRAFT);
                            onReset();
                        }}
                    >
                        {td("Reset", { source: "en" })}
                    </Button>
                    <div className="flex gap-2">
                        <Button onClick={onClose}>{td("Cancel", { source: "en" })}</Button>
                        <Button type="primary" onClick={() => onApply(draft)}>
                            {td("Apply", { source: "en" })}
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="flex flex-col gap-4 py-1">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        {td("Developer", { source: "en" })}
                    </label>
                    <Select
                        value={draft.developer_id || undefined}
                        onChange={(v) => update("developer_id", v ?? "")}
                        placeholder={td("All developers", { source: "en" })}
                        allowClear
                        className="w-full"
                        options={developers.map((d) => ({
                            value: String(d.id),
                            label: d.name,
                        }))}
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        {td("City", { source: "en" })}
                    </label>
                    <Select
                        value={draft.city || undefined}
                        onChange={(v) => update("city", v ?? "")}
                        placeholder={td("All cities", { source: "en" })}
                        allowClear
                        className="w-full"
                        options={cityOptions}
                        showSearch
                        optionFilterProp="label"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        {td("Area", { source: "en" })}
                    </label>
                    <Select
                        value={draft.area || undefined}
                        onChange={(v) => update("area", v ?? "")}
                        placeholder={
                            draft.city
                                ? "All areas"
                                : "Select a city first"
                        }
                        allowClear
                        disabled={!draft.city}
                        className="w-full"
                        options={areaOptions}
                        showSearch
                        optionFilterProp="label"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        {td("Status", { source: "en" })}
                    </label>
                    <Select
                        value={draft.construction_status || undefined}
                        onChange={(v) =>
                            update("construction_status", v ?? "")
                        }
                        placeholder={td("Any status", { source: "en" })}
                        allowClear
                        className="w-full"
                        options={PROJECT_CONSTRUCTION_STATUSES.map((s) => ({
                            value: s.value,
                            label: s.label,
                        }))}
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        {td("Category", { source: "en" })}
                    </label>
                    <Select
                        value={draft.primary_category || undefined}
                        onChange={(v) => update("primary_category", v ?? "")}
                        placeholder={td("Any category", { source: "en" })}
                        allowClear
                        className="w-full"
                        options={primaryCategories.map((c) => ({
                            value: c.name,
                            label: c.label,
                        }))}
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        {td("Plan months", { source: "en" })}
                    </label>
                    <Input
                        value={draft.payment_plan_duration}
                        onChange={(e) =>
                            update(
                                "payment_plan_duration",
                                e.target.value.replace(/\D/g, ""),
                            )
                        }
                        placeholder="e.g. 12"
                        type="number"
                        min={0}
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        {td("Price range", { source: "en" })}
                    </label>
                    <div className="flex items-center gap-2">
                        <Input
                            value={draft.price_min}
                            onChange={(e) =>
                                update("price_min", e.target.value)
                            }
                            placeholder={td("Min", { source: "en" })}
                            type="number"
                            min={0}
                        />
                        <span className="text-gray-400 text-sm">–</span>
                        <Input
                            value={draft.price_max}
                            onChange={(e) =>
                                update("price_max", e.target.value)
                            }
                            placeholder={td("Max", { source: "en" })}
                            type="number"
                            min={0}
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ProjectsFiltersModal;
