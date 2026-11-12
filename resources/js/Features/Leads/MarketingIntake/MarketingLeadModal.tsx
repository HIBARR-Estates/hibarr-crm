import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import Icon from "@/Components/Redesign/primitives/Icon";
import ModalShell from "@/Components/Redesign/primitives/ModalShell";
import SearchableSelect from "@/Components/Redesign/primitives/SearchableSelect";
import PhoneNumberField from "@/Components/PhoneNumberField";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import "@/Components/Redesign/redesign.css";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import UtmConfigSelect from "./UtmConfigSelect";
import CustomFieldInput from "./CustomFieldInput";
import {
    buildPayload,
    buildSteps,
    customFieldVisibility,
    emptyDraft,
    isValidWebsite,
    languageChoices,
    matchChoice,
    newNoteKey,
    sortChoices,
    stepForErrorKey,
    withDerivedAge,
} from "./model";
import type { MarketingLeadDraft, SavedMarketingLead, StepId, StepModel, UtmKey } from "./types";
import { UTM_KEYS } from "./types";
import useMarketingLeadOptions from "./useMarketingLeadOptions";
import useMarketingLeadSave from "./useMarketingLeadSave";
import "./marketing-lead-modal.css";

interface MarketingLeadModalProps {
    open: boolean;
    onClose: () => void;
    /** Called after each save, e.g. to refresh a list behind the modal. */
    onSaved?: (lead: SavedMarketingLead) => void;
}

type FieldKey = Exclude<keyof MarketingLeadDraft, "custom_fields_data" | "notes">;

/**
 * The marketing lead flow: a multi-step modal for entering one lead after
 * another. Personal details, address, every custom field category (with its
 * visibility rules) and notes, each on its own step. "Save and add another"
 * keeps it open with a clean form. The lead's origin is never shown here; the
 * server sets it on every lead saved through this flow.
 */
export default function MarketingLeadModal({ open, onClose, onSaved }: MarketingLeadModalProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { options, loading, failed, retry } = useMarketingLeadOptions(open);
    const { save, saving } = useMarketingLeadSave();

    const [draft, setDraft] = useState<MarketingLeadDraft>(() => emptyDraft());
    const defaultOwnerId = options?.defaultOwnerId ?? null;
    // Until someone picks an owner for this lead, it follows the settings default.
    const ownerTouchedRef = useRef(false);
    const [stepId, setStepId] = useState<StepId>("contact");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [savedThisSession, setSavedThisSession] = useState<SavedMarketingLead[]>([]);
    const [lastSaved, setLastSaved] = useState<SavedMarketingLead | null>(null);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const paneRef = useRef<HTMLDivElement>(null);
    const nameRef = useRef<HTMLInputElement>(null);
    const railRef = useRef<HTMLElement>(null);

    const dirty = useMemo(() => JSON.stringify({ ...draft, notes: draft.notes.map((n) => [n.title, n.details]) }) !==
        JSON.stringify({ ...emptyDraft(defaultOwnerId), notes: [["", ""]] }), [draft, defaultOwnerId]);

    useEffect(() => {
        if (defaultOwnerId == null || ownerTouchedRef.current) return;
        setDraft((prev) => (prev.lead_owner === "" ? { ...prev, lead_owner: String(defaultOwnerId) } : prev));
    }, [defaultOwnerId]);

    const visibility = useMemo(
        () => customFieldVisibility(options?.customFields ?? [], draft.custom_fields_data),
        [options, draft.custom_fields_data],
    );

    const steps = useMemo(
        () =>
            buildSteps(draft, options, visibility, {
                contact: t("pages.marketing_leads.steps.contact"),
                attribution: t("pages.marketing_leads.steps.attribution"),
                profile: t("pages.marketing_leads.steps.profile"),
                address: t("pages.marketing_leads.steps.address"),
                other: t("pages.marketing_leads.steps.more_details"),
                notes: t("pages.marketing_leads.steps.notes"),
            }),
        [draft, options, visibility, t],
    );

    // A step whose fields all became hidden disappears; fall back to the first.
    const stepIndex = Math.max(0, steps.findIndex((step) => step.id === stepId));
    const step = steps[stepIndex];
    const nextStep = steps[stepIndex + 1] ?? null;

    // On phones the rail scrolls sideways; keep the current section in view.
    useEffect(() => {
        const rail = railRef.current;
        const active = rail?.querySelector<HTMLElement>('[aria-current="step"]');
        if (!rail || !active || rail.scrollWidth <= rail.clientWidth) return;
        rail.scrollTo({ left: rail.scrollLeft + active.getBoundingClientRect().left - rail.getBoundingClientRect().left - 10, behavior: "smooth" });
    }, [step?.id]);
    const stepLabel = (model: StepModel) => (model.dynamicLabel ? td(model.label, { source: "en" }) : model.label);

    const errorsByStep = useMemo(() => {
        const counts: Partial<Record<StepId, number>> = {};
        for (const key of Object.keys(errors)) {
            const id = stepForErrorKey(key, steps);
            counts[id] = (counts[id] ?? 0) + 1;
        }
        return counts;
    }, [errors, steps]);

    const goTo = useCallback((id: StepId) => {
        setStepId(id);
        paneRef.current?.scrollTo({ top: 0 });
    }, []);

    const reset = useCallback(() => {
        ownerTouchedRef.current = false;
        setDraft(emptyDraft(defaultOwnerId));
        setErrors({});
        setFormError(null);
        setStepId("contact");
        paneRef.current?.scrollTo({ top: 0 });
    }, [defaultOwnerId]);

    useEffect(() => {
        if (!open) {
            reset();
            setLastSaved(null);
            setSavedThisSession([]);
        }
    }, [open, reset]);

    const setField = useCallback((key: FieldKey, value: string | string[]) => {
        if (key === "lead_owner") ownerTouchedRef.current = true;
        setDraft((prev) => {
            const next = { ...prev, [key]: value } as MarketingLeadDraft;
            if (key === "date_of_birth" || key === "age") {
                return { ...next, ...withDerivedAge(next) };
            }
            return next;
        });
        setErrors((prev) => {
            if (!(key in prev)) return prev;
            const { [key]: _removed, ...rest } = prev;
            return rest;
        });
    }, []);

    const setCustomField = useCallback((fieldId: number, value: unknown) => {
        const key = `field_${fieldId}`;
        setDraft((prev) => ({ ...prev, custom_fields_data: { ...prev.custom_fields_data, [key]: value } }));
        setErrors((prev) => {
            const errorKey = `custom_fields_data.${key}`;
            if (!(errorKey in prev)) return prev;
            const { [errorKey]: _removed, ...rest } = prev;
            return rest;
        });
    }, []);

    const handleSave = async (addAnother: boolean) => {
        if (draft.client_name.trim() === "") {
            setErrors((prev) => ({ ...prev, client_name: t("pages.marketing_leads.name_required") }));
            goTo("contact");
            nameRef.current?.focus();
            return;
        }

        if (!isValidWebsite(draft.website)) {
            setErrors((prev) => ({ ...prev, website: t("pages.marketing_leads.website_invalid") }));
            goTo("profile");
            requestAnimationFrame(() => document.getElementById("mli-website")?.focus());
            return;
        }

        setFormError(null);
        const result = await save(buildPayload(draft, options, visibility));

        if (!result.ok) {
            setErrors(result.errors);
            const firstKey = Object.keys(result.errors)[0];
            if (firstKey) {
                goTo(stepForErrorKey(firstKey, steps));
            } else {
                setFormError(result.message ?? t("pages.marketing_leads.save_failed"));
            }
            return;
        }

        onSaved?.(result.lead);
        setSavedThisSession((prev) => [result.lead, ...prev]);

        if (addAnother) {
            setLastSaved(result.lead);
            reset();
            requestAnimationFrame(() => nameRef.current?.focus());
            return;
        }

        onClose();
    };

    const requestClose = () => {
        if (saving) return;
        if (dirty) {
            setConfirmDiscard(true);
            return;
        }
        onClose();
    };

    const canSave = draft.client_name.trim() !== "" && !saving;
    const name = draft.client_name.trim();

    const field = (key: FieldKey, label: string, control: ReactNode, opts: { span?: 2 | 3; required?: boolean } = {}) => (
        <div
            className={`mli-fld${opts.span === 2 ? " mli-span-2" : opts.span === 3 ? " mli-span-3" : ""}${errors[key] ? " has-error" : ""}`}
        >
            <label htmlFor={`mli-${key}`}>
                {label}
                {opts.required && (
                    <span className="mli-req" aria-hidden="true">
                        *
                    </span>
                )}
            </label>
            {control}
            {errors[key] && <span className="mli-fld__error">{errors[key]}</span>}
        </div>
    );

    const textInput = (key: FieldKey, type: string = "text", extra: Record<string, unknown> = {}) => (
        <input
            id={`mli-${key}`}
            className="mli-inp"
            type={type}
            value={draft[key] as string}
            onChange={(event) => setField(key, event.target.value)}
            {...extra}
        />
    );

    const select = (
        key: FieldKey,
        choices: Array<{ value: string; label: string }>,
        opts: { multiple?: boolean; placeholder?: string } = {},
    ) =>
        opts.multiple ? (
            <SearchableSelect<string[]>
                id={`mli-${key}`}
                mode="multiple"
                allowClear
                value={draft[key] as string[]}
                placeholder={t("pages.marketing_leads.choose")}
                options={choices}
                filterOption={matchChoice}
                filterSort={(a, b, info) => sortChoices(info.searchValue)(a, b)}
                onChange={(next) => setField(key, next ?? [])}
                popupMatchSelectWidth
            />
        ) : (
            <SearchableSelect<string>
                id={`mli-${key}`}
                allowClear
                value={(draft[key] as string) || undefined}
                placeholder={opts.placeholder ?? t("pages.marketing_leads.choose")}
                options={choices}
                filterOption={matchChoice}
                filterSort={(a, b, info) => sortChoices(info.searchValue)(a, b)}
                onChange={(next) => setField(key, next ?? "")}
                popupMatchSelectWidth
            />
        );

    const chips = (key: FieldKey, choices: Array<{ value: string; label: string }>, single = false) => {
        const current = draft[key];
        return (
            <div className="mli-chips" role="group" aria-labelledby={`mli-${key}-label`}>
                {choices.map((choice) => {
                    const on = single ? current === choice.value : (current as string[]).includes(choice.value);
                    return (
                        <button
                            key={choice.value}
                            type="button"
                            className="mli-chip"
                            aria-pressed={on}
                            onClick={() => {
                                if (single) {
                                    setField(key, on ? "" : choice.value);
                                } else {
                                    const list = current as string[];
                                    setField(key, on ? list.filter((v) => v !== choice.value) : [...list, choice.value]);
                                }
                            }}
                        >
                            {choice.label}
                        </button>
                    );
                })}
            </div>
        );
    };

    const chipField = (key: FieldKey, label: string, control: ReactNode, span: 2 | 3 = 3) => (
        <div className={`mli-fld${span === 3 ? " mli-span-3" : " mli-span-2"}${errors[key] ? " has-error" : ""}`}>
            <span id={`mli-${key}-label`} className="mli-fld__label">
                {label}
            </span>
            {control}
            {errors[key] && <span className="mli-fld__error">{errors[key]}</span>}
        </div>
    );

    const loadingGrid = (
        <>
            <div className="mli-skel" />
            <div className="mli-skel" />
            <div className="mli-skel" />
        </>
    );

    const countries = options?.countries ?? [];
    const countryChoices = countries
        .filter((country) => country.nicename)
        .map((country) => ({ value: String(country.nicename), label: String(country.nicename) }));

    const renderStep = () => {
        if (step.id === "contact") {
            const phoneField = (key: "mobile" | "cell" | "office", label: string) => (
                <div className={`mli-fld${errors[key] ? " has-error" : ""}`}>
                    <label htmlFor={`mli-${key}`}>{label}</label>
                    <PhoneNumberField
                        id={`mli-${key}`}
                        className="mli-phone-input"
                        value={draft[key] || undefined}
                        countries={countries}
                        onValueChange={(next) => setField(key, next)}
                    />
                    {errors[key] && <span className="mli-fld__error">{errors[key]}</span>}
                </div>
            );
            return (
                <div className="mli-grid">
                    {field("salutation", t("pages.marketing_leads.fields.salutation"), select("salutation", options?.salutations ?? []))}
                    {field(
                        "client_name",
                        t("pages.marketing_leads.fields.name"),
                        textInput("client_name", "text", { ref: nameRef, autoComplete: "off", autoFocus: true }),
                        { span: 2, required: true },
                    )}
                    {field(
                        "client_email",
                        t("pages.marketing_leads.fields.email"),
                        textInput("client_email", "email", { autoComplete: "off" }),
                        { span: 2 },
                    )}

                    <h4 className="mli-cap mli-group">{t("pages.marketing_leads.groups.phone_numbers")}</h4>
                    <div className="mli-phone-grid">
                        {phoneField("mobile", t("pages.marketing_leads.fields.mobile"))}
                        {phoneField("cell", t("pages.marketing_leads.fields.alternate_phone"))}
                        {phoneField("office", t("pages.marketing_leads.fields.office_phone"))}
                    </div>
                    {options
                        ? chipField(
                              "preferred_contact_times",
                              t("pages.marketing_leads.fields.preferred_contact_time"),
                              chips("preferred_contact_times", options.preferredContactTimes),
                          )
                        : null}

                </div>
            );
        }

        if (!options) {
            return <div className="mli-grid">{loadingGrid}</div>;
        }

        if (step.id === "attribution") {
            const utmLabels: Record<UtmKey, string> = {
                utm_source: t("pages.marketing_leads.fields.utm_source"),
                utm_medium: t("pages.marketing_leads.fields.utm_medium"),
                utm_campaign: t("pages.marketing_leads.fields.utm_campaign"),
                utm_content: t("pages.marketing_leads.fields.utm_content"),
                utm_term: t("pages.marketing_leads.fields.utm_term"),
                utm_audience: t("pages.marketing_leads.fields.utm_audience"),
            };
            return (
                <div className="mli-grid">
                    {field(
                        "source_id",
                        t("pages.marketing_leads.fields.source"),
                        select(
                            "source_id",
                            options.sources.map((source) => ({ value: String(source.id), label: td(source.type, { source: "en" }) })),
                        ),
                    )}
                    {field(
                        "category_ids",
                        t("pages.marketing_leads.fields.categories"),
                        select(
                            "category_ids",
                            options.categories.map((category) => ({
                                value: String(category.id),
                                label: td(category.category_name, { source: "en" }),
                            })),
                            { multiple: true },
                        ),
                        { span: 2 },
                    )}
                    {field(
                        "lead_owner",
                        t("pages.marketing_leads.fields.owner"),
                        select(
                            "lead_owner",
                            options.owners.map((owner) => ({ value: String(owner.id), label: owner.name })),
                            { placeholder: t("pages.marketing_leads.owner_none") },
                        ),
                    )}
                    <p className="mli-hint mli-span-2">
                        {options.defaultOwnerId != null && draft.lead_owner === String(options.defaultOwnerId)
                            ? t("pages.marketing_leads.owner_default_hint")
                            : t("pages.marketing_leads.owner_hint")}
                    </p>

                    <h4 className="mli-cap mli-group">{t("pages.marketing_leads.groups.utm")}</h4>
                    {UTM_KEYS.map((key) => (
                        <div key={key} className={`mli-fld${errors[`utm.${key}`] ? " has-error" : ""}`}>
                            <label htmlFor={`mli-${key}`}>{utmLabels[key]}</label>
                            <UtmConfigSelect
                                field={key}
                                id={`mli-${key}`}
                                value={draft[key]}
                                placeholder={t("pages.marketing_leads.choose")}
                                onChange={(next, option) => {
                                    setField(key, next);
                                    // A source linked to a CRM lead source fills Lead source when it's empty.
                                    const linked = option?.leadSourceId;
                                    if (
                                        key === "utm_source" &&
                                        linked != null &&
                                        !draft.source_id &&
                                        options.sources.some((source) => source.id === linked)
                                    ) {
                                        setField("source_id", String(linked));
                                    }
                                }}
                            />
                            {errors[`utm.${key}`] && <span className="mli-fld__error">{errors[`utm.${key}`]}</span>}
                        </div>
                    ))}
                </div>
            );
        }

        if (step.id === "profile") {
            return (
                <div className="mli-grid">
                    {chipField("gender", t("pages.marketing_leads.fields.gender"), chips("gender", options.genders, true), 2)}
                    {field("temperature", t("pages.marketing_leads.fields.temperature"), select("temperature", options.temperatures))}
                    {field("date_of_birth", t("pages.marketing_leads.fields.date_of_birth"), textInput("date_of_birth", "date"))}
                    {field(
                        "age",
                        t("pages.marketing_leads.fields.age"),
                        textInput("age", "number", { min: 0, max: 150, disabled: draft.date_of_birth !== "" }),
                    )}
                    {field(
                        "age_range",
                        t("pages.marketing_leads.fields.age_range"),
                        <SearchableSelect<string>
                            id="mli-age_range"
                            allowClear
                            disabled={draft.date_of_birth !== "" || draft.age !== ""}
                            value={draft.age_range || undefined}
                            placeholder={t("pages.marketing_leads.choose")}
                            options={options.ageRanges}
                            onChange={(next) => setField("age_range", next ?? "")}
                            popupMatchSelectWidth
                        />,
                    )}
                    {field("nationality", t("pages.marketing_leads.fields.nationality"), select("nationality", countryChoices))}
                    {field(
                        "languages",
                        t("pages.marketing_leads.fields.languages"),
                        select(
                            "languages",
                            languageChoices(options.languages, draft.languages),
                            { multiple: true },
                        ),
                        { span: 2 },
                    )}
                    {field("occupation", t("pages.marketing_leads.fields.occupation"), textInput("occupation"))}
                    {field("company_name", t("pages.marketing_leads.fields.company"), textInput("company_name"))}
                    {field("website", t("pages.marketing_leads.fields.website"), textInput("website", "text", { inputMode: "url", autoComplete: "url", placeholder: "example.com", onBlur: () => {
                        if (!isValidWebsite(draft.website)) setErrors((prev) => ({ ...prev, website: t("pages.marketing_leads.website_invalid") }));
                    } }))}
                </div>
            );
        }

        if (step.id === "address") {
            return (
                <div className="mli-grid">
                    {field("address", t("pages.marketing_leads.fields.street"), textInput("address"), { span: 2 })}
                    {field("postal_code", t("pages.marketing_leads.fields.postcode"), textInput("postal_code"))}
                    {field("city", t("pages.marketing_leads.fields.city"), textInput("city"))}
                    {field("state", t("pages.marketing_leads.fields.state"), textInput("state"))}
                    {field("country", t("pages.marketing_leads.fields.country"), select("country", countryChoices))}
                </div>
            );
        }

        if (step.id === "notes") {
            return (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {draft.notes.map((note, index) => {
                        const detailsError = errors[`notes.${index}.details`];
                        return (
                            <div key={note.key} className="mli-note">
                                <div className="mli-note__head">
                                    <span className="mli-cap">{t("pages.marketing_leads.note_number", { number: index + 1 })}</span>
                                    {draft.notes.length > 1 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            icon={<Icon name="trash" size={14} />}
                                            aria-label={t("pages.marketing_leads.remove_note")}
                                            onClick={() =>
                                                setDraft((prev) => ({ ...prev, notes: prev.notes.filter((n) => n.key !== note.key) }))
                                            }
                                        />
                                    )}
                                </div>
                                <div className="mli-fld">
                                    <label htmlFor={`mli-note-title-${note.key}`}>{t("pages.marketing_leads.fields.note_title")}</label>
                                    <input
                                        id={`mli-note-title-${note.key}`}
                                        className="mli-inp"
                                        value={note.title}
                                        onChange={(event) =>
                                            setDraft((prev) => ({
                                                ...prev,
                                                notes: prev.notes.map((n) => (n.key === note.key ? { ...n, title: event.target.value } : n)),
                                            }))
                                        }
                                    />
                                </div>
                                <div className={`mli-fld${detailsError ? " has-error" : ""}`}>
                                    <label htmlFor={`mli-note-details-${note.key}`}>{t("pages.marketing_leads.fields.note")}</label>
                                    <textarea
                                        id={`mli-note-details-${note.key}`}
                                        className="mli-inp"
                                        value={note.details}
                                        placeholder={t("pages.marketing_leads.note_placeholder")}
                                        onChange={(event) =>
                                            setDraft((prev) => ({
                                                ...prev,
                                                notes: prev.notes.map((n) => (n.key === note.key ? { ...n, details: event.target.value } : n)),
                                            }))
                                        }
                                    />
                                    {detailsError && <span className="mli-fld__error">{detailsError}</span>}
                                </div>
                            </div>
                        );
                    })}
                    <div>
                        <Button
                            variant="ghost"
                            icon={<Icon name="plus" size={14} />}
                            onClick={() =>
                                setDraft((prev) => ({ ...prev, notes: [...prev.notes, { key: newNoteKey(), title: "", details: "" }] }))
                            }
                        >
                            {t("pages.marketing_leads.add_note")}
                        </Button>
                    </div>
                </div>
            );
        }

        // A custom field category (or "More details").
        return (
            <div className="mli-grid">
                {(step.fields ?? []).map((customField) => (
                    <CustomFieldInput
                        key={customField.id}
                        field={customField}
                        value={draft.custom_fields_data[`field_${customField.id}`]}
                        error={errors[`custom_fields_data.field_${customField.id}`]}
                        countries={countries}
                        onChange={(value) => setCustomField(customField.id, value)}
                    />
                ))}
            </div>
        );
    };

    const filledTotals = steps.reduce(
        (acc, model) => ({ filled: acc.filled + Math.min(model.filled, model.total), total: acc.total + model.total }),
        { filled: 0, total: 0 },
    );

    return (
        <>
            <ModalShell
                open={open}
                onClose={requestClose}
                onEscape={() => {
                    if (confirmDiscard) return true;
                    if (dirty || saving) {
                        requestClose();
                        return true;
                    }
                    return false;
                }}
                ariaLabelledBy="mli-title"
                overlayClassName="mli-overlay"
                panelClassName="modal-panel mli-panel"
                initialFocus="first"
                trapFocus
            >
                <header className="mli-head">
                    <span className="mli-head__avatar" aria-hidden="true">
                        {name ? initialsFromName(name) : <Icon name="user" size={18} />}
                    </span>
                    <div className="mli-head__text">
                        <h2 id="mli-title" className="mli-head__title">
                            {name ? t("pages.marketing_leads.title_named", { name }) : t("pages.marketing_leads.title")}
                        </h2>
                        <span className="mli-head__sub">
                            {savedThisSession.length > 0
                                ? t("pages.marketing_leads.subtitle_with_count", { count: savedThisSession.length })
                                : t("pages.marketing_leads.subtitle")}
                        </span>
                    </div>
                    <div className="mli-head__actions">
                        <Button variant="ghost" onClick={() => void handleSave(true)} disabled={!canSave}>
                            {t("pages.marketing_leads.save_and_add_another")}
                        </Button>
                        <Button variant="primary" onClick={() => void handleSave(false)} disabled={!canSave} loading={saving}>
                            {t("pages.marketing_leads.save_lead")}
                        </Button>
                        <button type="button" className="mli-close" onClick={requestClose} aria-label={t("app.close")}>
                            <Icon name="x" size={16} />
                        </button>
                    </div>
                </header>

                {lastSaved && (
                    <div className="mli-banner mli-banner--saved" role="status">
                        <span className="mli-dot" aria-hidden="true" />
                        <span>
                            <b>{t("pages.marketing_leads.saved_banner", { name: lastSaved.client_name })}</b>{" "}
                            {t("pages.marketing_leads.saved_banner_next")}
                        </span>
                        <a href={lastSaved.url} style={{ marginLeft: "auto" }}>
                            {t("pages.marketing_leads.open_lead")}
                        </a>
                    </div>
                )}
                {(formError || failed) && (
                    <div className="mli-banner mli-banner--error" role="alert">
                        <span className="mli-dot" aria-hidden="true" />
                        <span>{formError ?? t("pages.marketing_leads.options_failed")}</span>
                        {failed && (
                            <button
                                type="button"
                                onClick={retry}
                                style={{ marginLeft: "auto", border: 0, background: "none", font: "inherit", fontWeight: 600, color: "inherit", cursor: "pointer", textDecoration: "underline" }}
                            >
                                {t("pages.marketing_leads.retry")}
                            </button>
                        )}
                    </div>
                )}

                <div className="mli-body">
                    <nav className="mli-rail" ref={railRef} aria-label={t("pages.marketing_leads.sections")}>
                        <span className="mli-cap mli-rail__cap">
                            {t("pages.marketing_leads.sections_filled", { filled: filledTotals.filled, total: filledTotals.total })}
                        </span>
                        {steps.map((model) => {
                            const errorCount = errorsByStep[model.id] ?? 0;
                            const pct = model.total > 0 ? Math.round((Math.min(model.filled, model.total) / model.total) * 100) : model.filled > 0 ? 100 : 0;
                            return (
                                <button
                                    key={model.id}
                                    type="button"
                                    className="mli-step"
                                    aria-current={model.id === step.id ? "step" : undefined}
                                    onClick={() => goTo(model.id)}
                                >
                                    <span className="mli-step__row">
                                        <span className="mli-step__label">{stepLabel(model)}</span>
                                        {errorCount > 0 ? (
                                            <span className="mli-step__count mli-step__count--error">
                                                {t("pages.marketing_leads.step_errors", { count: errorCount })}
                                            </span>
                                        ) : (
                                            <span className="mli-step__count">
                                                {model.total > 0 ? `${Math.min(model.filled, model.total)}/${model.total}` : model.filled}
                                            </span>
                                        )}
                                    </span>
                                    <span className="mli-bar" aria-hidden="true">
                                        <i className={pct === 100 ? "is-full" : undefined} style={{ width: `${pct}%` }} />
                                    </span>
                                </button>
                            );
                        })}
                        {loading && <span className="mli-loading">{t("pages.marketing_leads.loading_sections")}</span>}
                    </nav>

                    <div className="mli-main">
                        <div className="mli-pane" ref={paneRef}>
                            <div className="mli-pane__head">
                                <h3 className="mli-pane__title">{stepLabel(step)}</h3>
                                <span className="mli-pane__hint">
                                    {step.id === "contact"
                                        ? t("pages.marketing_leads.hint_contact")
                                        : step.id === "notes"
                                          ? t("pages.marketing_leads.hint_notes")
                                          : t("pages.marketing_leads.hint_optional")}
                                </span>
                            </div>
                            {renderStep()}
                        </div>
                        <footer className="mli-foot">
                            <span className="mli-foot__hint">
                                {nextStep
                                    ? t("pages.marketing_leads.next_section_hint", { name: stepLabel(nextStep) })
                                    : t("pages.marketing_leads.last_section_hint")}
                            </span>
                            <div className="mli-foot__actions">
                                {stepIndex > 0 && (
                                    <Button variant="ghost" onClick={() => goTo(steps[stepIndex - 1].id)}>
                                        {t("pages.marketing_leads.back")}
                                    </Button>
                                )}
                                {nextStep ? (
                                    <Button variant="navy" onClick={() => goTo(nextStep.id)}>
                                        {t("pages.marketing_leads.next_section")}
                                    </Button>
                                ) : (
                                    <Button variant="primary" onClick={() => void handleSave(false)} disabled={!canSave} loading={saving}>
                                        {t("pages.marketing_leads.save_lead")}
                                    </Button>
                                )}
                            </div>
                        </footer>
                    </div>

                    <aside className="mli-side" aria-label={t("pages.marketing_leads.added_this_session")}>
                        <span className="mli-cap">
                            {t("pages.marketing_leads.added_this_session_count", { count: savedThisSession.length })}
                        </span>
                        {savedThisSession.length === 0 ? (
                            <p className="mli-side__empty">{t("pages.marketing_leads.added_this_session_empty")}</p>
                        ) : (
                            savedThisSession.map((lead) => (
                                <a key={lead.id} className="mli-saved" href={lead.url}>
                                    <b>{lead.client_name}</b>
                                    <span>{lead.client_email || t("pages.marketing_leads.no_email")}</span>
                                </a>
                            ))
                        )}
                    </aside>
                </div>
            </ModalShell>

            <ConfirmDialog
                open={confirmDiscard}
                zIndex={1400}
                title={t("pages.marketing_leads.discard_title")}
                message={t("pages.marketing_leads.discard_message")}
                confirmLabel={t("pages.marketing_leads.discard_confirm")}
                cancelLabel={t("pages.marketing_leads.keep_editing")}
                danger
                onConfirm={() => {
                    setConfirmDiscard(false);
                    onClose();
                }}
                onCancel={() => setConfirmDiscard(false)}
            />
        </>
    );
}
