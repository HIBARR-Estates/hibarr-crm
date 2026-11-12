import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { App } from "antd";
import Button from "@/Components/Redesign/primitives/Button";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import SearchableSelect from "@/Components/Redesign/primitives/SearchableSelect";
import { REDESIGN_TOKENS as T, REDESIGN_TYPE } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { LeadOriginRow, MarketingIntakeSettings } from "./types";

/**
 * Who may use the marketing lead flow (members of the picked departments)
 * which origin it stamps on every lead saved through it, and the lead owner
 * it suggests (people can change it per lead in the flow).
 */
export default function MarketingIntakeTab({
    settings,
    origins,
    onSaved,
}: {
    settings: MarketingIntakeSettings;
    origins: LeadOriginRow[];
    onSaved: (next: Pick<MarketingIntakeSettings, "department_ids" | "origin_id" | "owner_id">) => void;
}) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { message } = App.useApp();
    const [departmentIds, setDepartmentIds] = useState<number[]>(settings.department_ids);
    const [originId, setOriginId] = useState<number>(settings.origin_id);
    const [ownerId, setOwnerId] = useState<number | null>(settings.owner_id);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setDepartmentIds(settings.department_ids);
        setOriginId(settings.origin_id);
        setOwnerId(settings.owner_id);
    }, [settings.department_ids, settings.origin_id, settings.owner_id]);

    const dirty = useMemo(
        () =>
            originId !== settings.origin_id ||
            ownerId !== settings.owner_id ||
            [...departmentIds].sort().join(",") !== [...settings.department_ids].sort().join(","),
        [departmentIds, originId, settings],
    );

    const memberCount = settings.departments
        .filter((department) => departmentIds.includes(department.id))
        .reduce((total, department) => total + department.members_count, 0);

    const toggle = (id: number) =>
        setDepartmentIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await axios.put(
                route("settings-leads.marketing-intake.update"),
                { department_ids: departmentIds, origin_id: originId, owner_id: ownerId },
                { headers: { Accept: "application/json" } },
            );
            onSaved(res.data.marketingIntake);
            message.success(t("messages.updateSuccess"));
        } catch (error) {
            const data = (error as { response?: { data?: { message?: string } } })?.response?.data;
            message.error(data?.message || t("messages.somethingWentWrong"));
        } finally {
            setSaving(false);
        }
    };

    const label = { display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: T.GRAY_DARKER } as const;

    return (
        <div className="flex flex-col" style={{ gap: 22 }}>
            <p style={{ margin: 0, fontSize: REDESIGN_TYPE.BODY, color: T.TEXT_MUTED, lineHeight: 1.45, maxWidth: 620 }}>
                {t("pages.lead_settings.marketing.intro")}
            </p>

            <section>
                <span style={label}>{t("pages.lead_settings.marketing.departments_label")}</span>
                {settings.departments.length === 0 ? (
                    <EmptyState
                        icon="users"
                        title={t("pages.lead_settings.marketing.no_departments_title")}
                        description={t("pages.lead_settings.marketing.no_departments_description")}
                    />
                ) : (
                    <>
                        <div className="flex flex-wrap" style={{ gap: 8 }} role="group" aria-label={t("pages.lead_settings.marketing.departments_label")}>
                            {settings.departments.map((department) => {
                                const on = departmentIds.includes(department.id);
                                return (
                                    <button
                                        key={department.id}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => toggle(department.id)}
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 8,
                                            minHeight: 36,
                                            padding: "0 14px",
                                            borderRadius: 999,
                                            border: `1px solid ${on ? T.BLUE : T.BORDER}`,
                                            background: on ? T.BLUE_LIGHT : T.WHITE,
                                            color: on ? T.BLUE_DARK : T.GRAY_DARKER,
                                            fontSize: 13,
                                            fontWeight: on ? 600 : 500,
                                            cursor: "pointer",
                                        }}
                                    >
                                        {td(department.name, { source: "en" })}
                                        <span style={{ fontSize: 12, color: on ? T.BLUE_DARK : T.TEXT_MUTED }}>
                                            {department.members_count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <p style={{ margin: "10px 0 0", fontSize: 12, color: departmentIds.length ? T.TEXT_MUTED : T.AMBER_TEXT }}>
                            {departmentIds.length === 0
                                ? t("pages.lead_settings.marketing.nobody_has_access")
                                : t("pages.lead_settings.marketing.people_have_access", { count: memberCount })}
                        </p>
                    </>
                )}
            </section>

            <section style={{ maxWidth: 360 }}>
                <label htmlFor="marketing-intake-origin" style={label}>
                    {t("pages.lead_settings.marketing.origin_label")}
                </label>
                <SearchableSelect<number>
                    id="marketing-intake-origin"
                    style={{ width: "100%" }}
                    value={originId}
                    options={origins.map((origin) => ({ value: origin.id, label: td(origin.name, { source: "en" }) }))}
                    onChange={(next) => setOriginId(next)}
                    popupMatchSelectWidth
                />
                <p style={{ margin: "8px 0 0", fontSize: 12, color: T.TEXT_MUTED, lineHeight: 1.45 }}>
                    {t("pages.lead_settings.marketing.origin_help")}
                </p>
            </section>

            <section style={{ maxWidth: 360 }}>
                <label htmlFor="marketing-intake-owner" style={label}>
                    {t("pages.lead_settings.marketing.owner_label")}
                </label>
                <SearchableSelect<number>
                    id="marketing-intake-owner"
                    style={{ width: "100%" }}
                    allowClear
                    value={ownerId ?? undefined}
                    placeholder={t("pages.lead_settings.marketing.owner_none")}
                    options={settings.owners.map((owner) => ({ value: owner.id, label: owner.name }))}
                    onChange={(next) => setOwnerId(next ?? null)}
                    popupMatchSelectWidth
                />
                <p style={{ margin: "8px 0 0", fontSize: 12, color: T.TEXT_MUTED, lineHeight: 1.45 }}>
                    {t("pages.lead_settings.marketing.owner_help")}
                </p>
            </section>

            <div className="flex justify-end" style={{ gap: 8, borderTop: `1px solid ${T.BORDER}`, paddingTop: 16 }}>
                <Button
                    variant="ghost"
                    disabled={!dirty || saving}
                    onClick={() => {
                        setDepartmentIds(settings.department_ids);
                        setOriginId(settings.origin_id);
                        setOwnerId(settings.owner_id);
                    }}
                >
                    {t("app.cancel")}
                </Button>
                <Button variant="primary" disabled={!dirty} loading={saving} onClick={() => void handleSave()}>
                    {t("app.save")}
                </Button>
            </div>
        </div>
    );
}
