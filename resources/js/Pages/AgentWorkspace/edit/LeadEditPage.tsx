import { useEffect, useMemo, useState } from "react";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import Icon from "@/Components/Redesign/primitives/Icon";
import { initialsFromName } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import LeadMergeReviewModal from "@/Features/Leads/Merge/LeadMergeReviewModal";
import { useCompanyCurrency } from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import { getDossierFieldValue } from "@/Pages/Leads/Redesign/adapters/dossierAdapter";
import { useLeadWorkspace } from "@/Pages/Leads/Redesign/context/LeadWorkspaceContext";
import type useLeadDuplicates from "@/Pages/Leads/Redesign/hooks/useLeadDuplicates";
import { buildKeyFacts } from "../contact/model";
import useKeyFactLabels from "../contact/useKeyFactLabels";
import {
    EDIT_SECTIONS,
    draftLead,
    isFilled,
    readableValue,
    type EditField,
    type EditOptions,
    type EditSection,
} from "./leadEditForm";
import useLeadEditForm from "./useLeadEditForm";
import "./lead-edit.css";

interface LeadEditPageProps {
    options: EditOptions;
    /** The lead's lifecycle status as it reads now, shown locked while editing. */
    statusLabel: string;
    duplicates: ReturnType<typeof useLeadDuplicates>;
    onClose: () => void;
}

const PREFIX = "pages.agent_workspace.contact.edit";

/**
 * Edit details for one person, in the agent workspace (canvas L7-09): one edit
 * mode, section by section, with the changes and what the key facts will read
 * after saving always in view. The lifecycle status is never a field here.
 */
export default function LeadEditPage({ options, statusLabel, duplicates, onClose }: LeadEditPageProps) {
    const { t, locale } = useTranslation();
    const { td } = useTd();
    const { lead } = useLeadWorkspace();
    const companyCurrency = useCompanyCurrency();
    const keyFactLabels = useKeyFactLabels();
    const { form, initial, changed, setField, undo, save, saving, nameMissing } = useLeadEditForm(lead, onClose);

    const [sectionId, setSectionId] = useState<EditSection["id"]>("profile");
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const [reviewId, setReviewId] = useState<number | null>(null);
    const [notSame, setNotSame] = useState(false);

    const dirty = changed.length > 0;

    // Leaving the page by closing the tab, with changes not saved.
    useEffect(() => {
        if (!dirty) return undefined;
        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    const optionLabels = useMemo<Record<string, string>>(
        () => ({
            male: t(`${PREFIX}.options.male`),
            female: t(`${PREFIX}.options.female`),
            cold: t(`${PREFIX}.options.cold`),
            warm: t(`${PREFIX}.options.warm`),
            hot: t(`${PREFIX}.options.hot`),
            "1": t(`${PREFIX}.options.yes`),
            "0": t(`${PREFIX}.options.no`),
            morning: t(`${PREFIX}.options.morning`),
            afternoon: t(`${PREFIX}.options.afternoon`),
            evening: t(`${PREFIX}.options.evening`),
        }),
        [t],
    );

    const fieldLabel = (field: EditField) => t(`${PREFIX}.fields.${field.label}`);
    // "Add company": the label in lower case, except in German where nouns keep their capital.
    const addText = (field: EditField) =>
        t(`${PREFIX}.add_field`, { field: locale === "de" ? fieldLabel(field) : fieldLabel(field).toLocaleLowerCase(locale) });

    const editable = (section: EditSection) => section.fields.filter((field) => field.input !== "readonly");
    const counts = EDIT_SECTIONS.map((section) => {
        const fields = editable(section);
        return { id: section.id, filled: fields.filter((field) => isFilled(form[field.key])).length, total: fields.length };
    });
    const filledTotal = counts.reduce((sum, item) => sum + item.filled, 0);
    const total = counts.reduce((sum, item) => sum + item.total, 0);

    const index = EDIT_SECTIONS.findIndex((section) => section.id === sectionId);
    const section = EDIT_SECTIONS[index];
    const next = EDIT_SECTIONS[index + 1];
    const emptyHere = editable(section).filter((field) => !isFilled(form[field.key])).length;

    // What the key facts will read after saving: only the tiles that change.
    const factChanges = useMemo(() => {
        if (!dirty) return [];
        const before = buildKeyFacts(lead, keyFactLabels, companyCurrency);
        const after = buildKeyFacts(draftLead(lead, form, options), keyFactLabels, companyCurrency);
        return after.filter((group, at) => {
            const old = before[at];
            return !old || old.lead !== group.lead || old.lines.join("\n") !== group.lines.join("\n");
        });
    }, [companyCurrency, dirty, form, keyFactLabels, lead, options]);

    const close = () => (dirty ? setConfirmDiscard(true) : onClose());
    const name = lead.client_name || t(`${PREFIX}.unnamed`);
    const candidate = duplicates.visible && !notSame ? duplicates.duplicates[0] : undefined;

    const selectOptions = (field: EditField): Array<{ value: string; label: string }> => {
        switch (field.options) {
            case "salutation":
                return options.salutations;
            case "age_range":
                return options.ageRanges;
            case "country":
                return options.countries.map((item) => ({ value: item.iso, label: item.nicename }));
            case "source":
                return options.sources.map((item) => ({ value: String(item.id), label: item.type }));
            case "category":
                return options.categories.map((item) => ({ value: String(item.id), label: item.category_name }));
            case "contact_time":
                return ["morning", "afternoon", "evening"].map((value) => ({ value, label: optionLabels[value] }));
            case "gender":
                return ["male", "female"].map((value) => ({ value, label: optionLabels[value] }));
            case "temperature":
                return ["cold", "warm", "hot"].map((value) => ({ value, label: optionLabels[value] }));
            case "yes_no":
                return [
                    { value: "1", label: optionLabels["1"] },
                    { value: "0", label: optionLabels["0"] },
                ];
            default:
                return [];
        }
    };

    const renderField = (field: EditField) => {
        const value = form[field.key] ?? "";
        const id = `agent-edit-${field.key}`;
        const isChanged = changed.includes(field.key);
        const empty = !isFilled(value);
        const missing = field.key === "client_name" && nameMissing;
        const state = [isChanged ? "is-changed" : "", empty && field.input !== "readonly" ? "is-empty" : "", missing ? "is-invalid" : ""]
            .filter(Boolean)
            .join(" ");

        let control;
        if (field.input === "readonly") {
            control = (
                <span id={id} className="agent-edit__ro">
                    {td(getDossierFieldValue(lead, "addedBy"), { source: "en" }) || "—"}
                </span>
            );
        } else if (field.input === "select") {
            // Age range follows the date of birth when there is one.
            const derived = field.key === "age_range" && isFilled(form.date_of_birth);
            control = (
                <select
                    id={id}
                    className={`agent-edit__input agent-edit__select ${state}${derived ? " is-derived" : ""}`}
                    value={value}
                    disabled={derived}
                    onChange={(event) => setField(field.key, event.target.value)}
                >
                    <option value="">{empty ? addText(field) : t(`${PREFIX}.not_set`)}</option>
                    {selectOptions(field).map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            );
        } else if (field.input === "multi") {
            const chosen = value.split(",").filter(Boolean);
            control = (
                <div id={id} role="group" aria-label={fieldLabel(field)} className={`agent-edit__chips ${state}`}>
                    {selectOptions(field).map((option) => {
                        const on = chosen.includes(option.value);
                        return (
                            <button
                                key={option.value}
                                type="button"
                                className={`agent-edit__chip${on ? " is-on" : ""}`}
                                aria-pressed={on}
                                onClick={() =>
                                    setField(
                                        field.key,
                                        (on ? chosen.filter((item) => item !== option.value) : [...chosen, option.value]).join(","),
                                    )
                                }
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            );
        } else {
            control = (
                <input
                    id={id}
                    className={`agent-edit__input ${state}`}
                    type={field.input}
                    inputMode={field.input === "tel" ? "tel" : undefined}
                    value={value}
                    placeholder={field.input === "date" ? undefined : addText(field)}
                    aria-invalid={missing || undefined}
                    onChange={(event) => setField(field.key, event.target.value)}
                />
            );
        }

        return (
            <div key={field.key} className={`agent-edit__field${field.wide ? " agent-edit__field--wide" : ""}`}>
                <label htmlFor={id} className="agent-edit__label">
                    {fieldLabel(field)}
                    {isChanged ? <span className="agent-edit__changed"> · {t(`${PREFIX}.changed`)}</span> : null}
                </label>
                {control}
                {missing ? <span className="agent-edit__error">{t(`${PREFIX}.name_required`)}</span> : null}
            </div>
        );
    };

    const fieldByKey = (key: string) => EDIT_SECTIONS.flatMap((item) => item.fields).find((field) => field.key === key);
    const shown = (field: EditField, raw: string | undefined) =>
        readableValue(field, raw, options, optionLabels) || t(`${PREFIX}.empty_value`);

    const saveLabel =
        changed.length === 0
            ? t(`${PREFIX}.save_none`)
            : changed.length === 1
              ? t(`${PREFIX}.save_one`)
              : t(`${PREFIX}.save_other`, { count: changed.length });
    const subtitle =
        changed.length === 0
            ? t(`${PREFIX}.subtitle_none`)
            : changed.length === 1
              ? t(`${PREFIX}.subtitle_one`)
              : t(`${PREFIX}.subtitle_other`, { count: changed.length });

    return (
        <div className="lead-redesign agent-contact agent-edit">
            <section className="agent-edit__card" aria-label={t(`${PREFIX}.title`, { name })}>
                <header className="agent-edit__head">
                    <span className="agent-edit__avatar" aria-hidden="true">
                        {initialsFromName(lead.client_name)}
                    </span>
                    <div className="agent-edit__title">
                        <h1>{t(`${PREFIX}.title`, { name })}</h1>
                        <p>{subtitle}</p>
                    </div>
                    <div className="agent-edit__head-actions">
                        <Button variant="ghost" onClick={close} disabled={saving}>
                            {t(`${PREFIX}.cancel`)}
                        </Button>
                        <Button variant="primary" onClick={() => void save()} disabled={!dirty} loading={saving}>
                            {saveLabel}
                        </Button>
                    </div>
                </header>

                <div className="agent-edit__status">
                    <span className="agent-edit__dot" aria-hidden="true" />
                    <span>
                        <b>{t(`${PREFIX}.status_lead`, { status: td(statusLabel, { source: "en" }) })}</b> {t(`${PREFIX}.status_stays`)}
                    </span>
                    <span className="agent-edit__locked">
                        <Icon name="lock" size={12} />
                        {t(`${PREFIX}.status_locked`)}
                    </span>
                </div>

                {candidate ? (
                    <div className="agent-edit__dup" role="alert">
                        <span className="agent-edit__dup-mark" aria-hidden="true">
                            !
                        </span>
                        <div className="agent-edit__dup-text">
                            <b>{t(`${PREFIX}.duplicate_title`, { name: candidate.client_name || t(`${PREFIX}.unnamed`) })}</b>
                            <span>
                                {[candidate.client_email, candidate.mobile, candidate.company_name].filter(Boolean).join(" · ")}
                                {duplicates.duplicates.length > 1
                                    ? ` · ${t(`${PREFIX}.duplicate_more`, { count: duplicates.duplicates.length - 1 })}`
                                    : ""}
                            </span>
                        </div>
                        <Button variant="navy" size="sm" onClick={() => setReviewId(candidate.id)}>
                            {t(`${PREFIX}.review_merge`)}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setNotSame(true)}>
                            {t(`${PREFIX}.not_same`)}
                        </Button>
                    </div>
                ) : null}

                <div className="agent-edit__body">
                    <nav className="agent-edit__nav" aria-label={t(`${PREFIX}.sections_aria`)}>
                        <span className="agent-edit__cap">{t(`${PREFIX}.sections_cap`, { filled: filledTotal, total })}</span>
                        <ul>
                            {EDIT_SECTIONS.map((item) => {
                                const count = counts.find((entry) => entry.id === item.id);
                                const done = count ? count.filled === count.total : false;
                                const active = item.id === sectionId;
                                return (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            className={`agent-edit__tab${active ? " is-active" : ""}`}
                                            aria-current={active ? "true" : undefined}
                                            onClick={() => setSectionId(item.id)}
                                        >
                                            <span className="agent-edit__tab-row">
                                                {t(`${PREFIX}.sections.${item.id}`)}
                                                <span className="agent-edit__tab-count">
                                                    {count ? `${count.filled}/${count.total}` : ""}
                                                </span>
                                            </span>
                                            <span className="agent-edit__meter" aria-hidden="true">
                                                <i
                                                    className={done ? "is-done" : undefined}
                                                    style={{ width: `${count && count.total ? (count.filled / count.total) * 100 : 0}%` }}
                                                />
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>

                    <div className="agent-edit__main">
                        <div className="agent-edit__main-head">
                            <h2>{t(`${PREFIX}.sections.${section.id}`)}</h2>
                            <span>
                                {emptyHere === 0
                                    ? t(`${PREFIX}.hint_complete`)
                                    : emptyHere === 1
                                      ? t(`${PREFIX}.hint_empty_one`)
                                      : t(`${PREFIX}.hint_empty_other`, { count: emptyHere })}
                            </span>
                        </div>
                        <div className="agent-edit__grid">{section.fields.map(renderField)}</div>
                        <footer className="agent-edit__foot">
                            <span>
                                {next ? t(`${PREFIX}.next_up`, { name: t(`${PREFIX}.sections.${next.id}`) }) : t(`${PREFIX}.last`)}
                            </span>
                            {next ? (
                                <Button variant="navy" onClick={() => setSectionId(next.id)}>
                                    {t(`${PREFIX}.next_btn`)}
                                    <Icon name="chevron-right" size={14} />
                                </Button>
                            ) : (
                                <Button variant="navy" onClick={() => void save()} disabled={!dirty} loading={saving}>
                                    {saveLabel}
                                </Button>
                            )}
                        </footer>
                    </div>

                    <aside className="agent-edit__side">
                        <span className="agent-edit__cap">{t(`${PREFIX}.changes_cap`, { count: changed.length })}</span>
                        {changed.length === 0 ? (
                            <p className="agent-edit__none">{t(`${PREFIX}.changes_none`)}</p>
                        ) : (
                            <ul className="agent-edit__changes">
                                {changed.map((key) => {
                                    const field = fieldByKey(key);
                                    if (!field) return null;
                                    return (
                                        <li key={key} className="agent-edit__change">
                                            <span className="agent-edit__change-head">
                                                {fieldLabel(field)}
                                                <button type="button" className="agent-edit__undo" onClick={() => undo(key)}>
                                                    <span aria-hidden="true">↶</span> {t(`${PREFIX}.undo`)}
                                                </button>
                                            </span>
                                            <span className="agent-edit__change-values">
                                                <s>{shown(field, initial[key])}</s> → <b>{shown(field, form[key])}</b>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        <span className="agent-edit__cap agent-edit__cap--spaced">{t(`${PREFIX}.facts_cap`)}</span>
                        {factChanges.length === 0 ? <p className="agent-edit__none">{t(`${PREFIX}.facts_same`)}</p> : null}
                        <ul className="agent-edit__facts">
                            {factChanges.map((group) => (
                                <li key={group.id} className="agent-edit__fact">
                                    <b>{group.label ? td(group.label, { source: "en" }) : t(`pages.agent_workspace.contact.facts.${group.id}`)}</b>
                                    <span className="agent-edit__fact-lead">
                                        {group.lead || t("pages.agent_workspace.contact.facts.empty")}
                                    </span>
                                    {group.lines.map((line) => (
                                        <span key={line} className="agent-edit__fact-line">
                                            {line}
                                        </span>
                                    ))}
                                </li>
                            ))}
                        </ul>
                    </aside>
                </div>
            </section>

            <ConfirmDialog
                open={confirmDiscard}
                title={t(`${PREFIX}.discard_title`)}
                message={changed.length === 1 ? t(`${PREFIX}.discard_body_one`) : t(`${PREFIX}.discard_body_other`, { count: changed.length })}
                confirmLabel={t(`${PREFIX}.discard`)}
                cancelLabel={t(`${PREFIX}.keep_editing`)}
                danger
                onConfirm={() => {
                    setConfirmDiscard(false);
                    onClose();
                }}
                onCancel={() => setConfirmDiscard(false)}
            />
            {reviewId !== null ? (
                <LeadMergeReviewModal
                    open
                    primaryId={lead.id}
                    duplicateId={reviewId}
                    onClose={(merged) => {
                        setReviewId(null);
                        if (merged) void duplicates.invalidate();
                    }}
                />
            ) : null}
        </div>
    );
}
