import { SearchOutlined } from "@ant-design/icons";
import SearchableSelect from "@/Components/Redesign/primitives/SearchableSelect";
import Button from "@/Components/Redesign/primitives/Button";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { AuditEvent, AuditLogFilterOptions, AuditLogFilters, AuditSource } from "../types";

interface AuditLogFilterBarProps {
    filters: AuditLogFilters;
    onChange: (patch: Partial<Omit<AuditLogFilters, "page">>) => void;
    onReset: () => void;
    activeCount: number;
    events: AuditEvent[];
    sources: AuditSource[];
    /** Deferred server prop; undefined while it is still loading. */
    options?: AuditLogFilterOptions;
}

const SELECT_STYLE = { minWidth: 180, flex: "1 1 180px", maxWidth: 260 };

/**
 * Who / what / which record / where from / when. Every control writes
 * straight into the URL-synced filter state; the list refetches on change.
 */
export default function AuditLogFilterBar({
    filters,
    onChange,
    onReset,
    activeCount,
    events,
    sources,
    options,
}: AuditLogFilterBarProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const optionsLoading = options === undefined;

    const userOptions = [
        { value: 0, label: t("app.auditLog.system") },
        ...(options?.users ?? []).map((u) => ({ value: u.id, label: u.name })),
    ];
    const typeOptions = (options?.types ?? []).map((type) => ({
        value: type.value,
        label: td(type.label, { source: "en" }),
    }));
    const eventOptions = events.map((event) => ({ value: event, label: t(`app.auditLog.events.${event}`) }));
    const sourceOptions = sources.map((source) => ({ value: source, label: t(`app.auditLog.sources.${source}`) }));

    return (
        <div
            className="rounded-[10px] border bg-white p-3.5 mb-3.5 flex flex-col gap-3"
            style={{ borderColor: T.BORDER }}
        >
            <div className="flex gap-2.5 flex-wrap items-center">
                <div className="relative" style={{ flex: "2 1 260px", minWidth: 220 }}>
                    <SearchOutlined
                        className="absolute top-1/2 -translate-y-1/2"
                        style={{ left: 11, color: T.TEXT_HINT }}
                    />
                    <input
                        value={filters.search}
                        onChange={(e) => onChange({ search: e.target.value })}
                        placeholder={t("app.auditLog.search")}
                        aria-label={t("app.auditLog.search")}
                        className="dr-input w-full"
                        style={{ paddingLeft: 32 }}
                    />
                </div>
                <input
                    value={filters.recordId}
                    onChange={(e) => onChange({ recordId: e.target.value })}
                    placeholder={t("app.auditLog.recordId")}
                    aria-label={t("app.auditLog.recordId")}
                    className="dr-input"
                    style={{ width: 130 }}
                />
                <label className="flex items-center gap-1.5" style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                    {t("app.auditLog.dateFrom")}
                    <input
                        type="date"
                        value={filters.dateFrom}
                        max={filters.dateTo || undefined}
                        onChange={(e) => onChange({ dateFrom: e.target.value })}
                        className="dr-input"
                        style={{ width: 150 }}
                    />
                </label>
                <label className="flex items-center gap-1.5" style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                    {t("app.auditLog.dateTo")}
                    <input
                        type="date"
                        value={filters.dateTo}
                        min={filters.dateFrom || undefined}
                        onChange={(e) => onChange({ dateTo: e.target.value })}
                        className="dr-input"
                        style={{ width: 150 }}
                    />
                </label>
            </div>

            <div className="flex gap-2.5 flex-wrap items-center">
                <SearchableSelect<number[]>
                    mode="multiple"
                    maxTagCount="responsive"
                    allowClear
                    value={filters.users}
                    onChange={(value) => onChange({ users: value ?? [] })}
                    options={userOptions}
                    loading={optionsLoading}
                    placeholder={t("app.auditLog.anyUser")}
                    aria-label={t("app.auditLog.user")}
                    style={SELECT_STYLE}
                />
                <SearchableSelect<string[]>
                    mode="multiple"
                    maxTagCount="responsive"
                    allowClear
                    value={filters.events}
                    onChange={(value) => onChange({ events: (value ?? []) as AuditEvent[] })}
                    options={eventOptions}
                    placeholder={t("app.auditLog.anyAction")}
                    aria-label={t("app.auditLog.action")}
                    style={SELECT_STYLE}
                />
                <SearchableSelect<string[]>
                    mode="multiple"
                    maxTagCount="responsive"
                    allowClear
                    value={filters.types}
                    onChange={(value) => onChange({ types: value ?? [] })}
                    options={typeOptions}
                    loading={optionsLoading}
                    placeholder={t("app.auditLog.anyRecordType")}
                    aria-label={t("app.auditLog.recordType")}
                    style={SELECT_STYLE}
                />
                <SearchableSelect<string[]>
                    mode="multiple"
                    maxTagCount="responsive"
                    allowClear
                    value={filters.sources}
                    onChange={(value) => onChange({ sources: (value ?? []) as AuditSource[] })}
                    options={sourceOptions}
                    placeholder={t("app.auditLog.anySource")}
                    aria-label={t("app.auditLog.source")}
                    style={SELECT_STYLE}
                />
                {activeCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={onReset} className="ml-auto">
                        {t("app.auditLog.clearFilters")} ({activeCount})
                    </Button>
                )}
            </div>
        </div>
    );
}
