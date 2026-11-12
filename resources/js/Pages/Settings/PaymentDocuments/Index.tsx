import React, { cloneElement, isValidElement, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { Deferred, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Button, Badge, FileDropzone, REDESIGN_TOKENS as T } from "@/Components/Redesign";
import SectionLabel from "@/Components/Redesign/primitives/SectionLabel";
import ToggleField from "@/Components/Redesign/primitives/ToggleField";
import "@/Components/Redesign/redesign.css";
import useTranslation from "@/Hooks/useTranslation";
import usePaymentDocumentSettings from "./usePaymentDocumentSettings";
import type {
    DocumentKind,
    Numbering,
    PaymentDocumentSettings,
    PaymentDocumentSettingsForm,
} from "./types";

interface Props {
    pageTitle: string;
    settings: PaymentDocumentSettings;
    numbering?: Numbering;
}

const KEY = "pages.payment_document_settings";

const BRAND_PRESETS = ["#1d4d5c", "#1f2f57", "#6b2d3c", "#2b2f33", "#28543a"];

const toForm = (s: PaymentDocumentSettings): PaymentDocumentSettingsForm => {
    const { saved: _saved, logo_url: _logo, ...rest } = s;
    return rest;
};

/** Pads like the PDF does: "A 000243". */
const formatNumber = (series: string, sequence: number, padding: number) =>
    `${series} ${String(sequence).padStart(Math.max(1, padding), "0")}`.trim();

export default function PaymentDocumentSettingsPage({
    pageTitle,
    settings: initial,
}: Props) {
    const { t } = useTranslation();
    const k = (key: string, params?: Record<string, string | number>) =>
        t(`${KEY}.${key}`, params);

    const { settings, numbering, saving, uploading, errors, save, uploadLogo, removeLogo } =
        usePaymentDocumentSettings(initial, {
            saved: k("saved"),
            saveFailed: k("save_failed"),
            uploadFailed: k("upload_failed"),
        });

    const [form, setForm] = useState<PaymentDocumentSettingsForm>(() => toForm(initial));
    const [baseline, setBaseline] = useState<PaymentDocumentSettingsForm>(() => toForm(initial));
    const dirty = useMemo(
        () => JSON.stringify(form) !== JSON.stringify(baseline) || !settings.saved,
        [form, baseline, settings.saved],
    );

    const set = <K extends keyof PaymentDocumentSettingsForm>(
        key: K,
        value: PaymentDocumentSettingsForm[K],
    ) => setForm((prev) => ({ ...prev, [key]: value }));

    const text = (key: keyof PaymentDocumentSettingsForm) => ({
        value: (form[key] as string | null) ?? "",
        onChange: (
            e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => set(key, (e.target.value === "" ? null : e.target.value) as never),
    });

    const integer = (key: keyof PaymentDocumentSettingsForm, nullable = false) => ({
        type: "number",
        inputMode: "numeric" as const,
        value: form[key] === null || form[key] === undefined ? "" : String(form[key]),
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            const raw = e.target.value;
            set(
                key,
                (raw === "" ? (nullable ? null : 0) : Math.max(0, parseInt(raw, 10) || 0)) as never,
            );
        },
    });

    const onSave = async () => {
        const ok = await save(form);
        if (ok) setBaseline(form);
    };

    const onReset = () => setForm(baseline);

    const openPreview = (kind: DocumentKind) =>
        window.open(route("payment-document-settings.api.preview", { kind }), "_blank", "noopener");

    const pageProps = usePage().props as { numbering?: Numbering };
    const liveNumbering = numbering ?? pageProps.numbering ?? null;

    return (
        <PageLayout
            breadcrumbs={[
                { name: t("app.menu.settings"), url: route("settings-overview.index") },
                { name: pageTitle },
            ]}
            title={pageTitle}
            config={{ showTitle: true }}
        >
            <div className="mx-auto w-full max-w-screen-xl pb-24">
                <p className="mb-5 max-w-3xl text-[13px] leading-relaxed" style={{ color: T.TEXT_MUTED }}>
                    {k("intro")}
                </p>

                <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="flex min-w-0 flex-col gap-5">
                        <Section title={k("business.title")} description={k("business.description")}>
                            <Grid>
                                <Field htmlFor="pds-legal-name" label={k("business.legal_name")} required error={errors.legal_name} wide>
                                    <input id="pds-legal-name" className="dr-input" {...text("legal_name")} />
                                </Field>
                                <Field htmlFor="pds-address" label={k("business.address")} required error={errors.address} wide>
                                    <textarea id="pds-address" className="dr-input" rows={2} {...text("address")} />
                                </Field>
                                <Field htmlFor="pds-phone" label={k("business.phone")} error={errors.phone}>
                                    <input id="pds-phone" className="dr-input" {...text("phone")} />
                                </Field>
                                <Field htmlFor="pds-email" label={k("business.email")} error={errors.email}>
                                    <input id="pds-email" className="dr-input" type="email" {...text("email")} />
                                </Field>
                                <Field htmlFor="pds-tax-office" label={k("business.tax_office")} hint={k("business.tax_office_hint")} required error={errors.tax_office}>
                                    <input id="pds-tax-office" className="dr-input" {...text("tax_office")} />
                                </Field>
                                <Field htmlFor="pds-tax-number" label={k("business.tax_number")} hint={k("business.tax_number_hint")} required error={errors.tax_number}>
                                    <input id="pds-tax-number" className="dr-input" {...text("tax_number")} />
                                </Field>
                                <Field htmlFor="pds-registration" label={k("business.registration_number")} error={errors.registration_number}>
                                    <input id="pds-registration" className="dr-input" {...text("registration_number")} />
                                </Field>
                            </Grid>
                        </Section>

                        <Section title={k("branding.title")} description={k("branding.description")}>
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                <div className="min-w-0">
                                    <FieldLabel>{k("branding.logo")}</FieldLabel>
                                    {settings.logo_url ? (
                                        <div
                                            className="flex items-center gap-4 rounded-[10px] p-3"
                                            style={{ border: `1px solid ${T.BORDER}`, background: T.SURFACE_2 }}
                                        >
                                            <img
                                                src={settings.logo_url}
                                                alt=""
                                                className="max-h-14 max-w-[160px] object-contain"
                                            />
                                            <div className="ml-auto flex gap-2">
                                                <label className="dr-btn dr-btn-ghost dr-btn-sm cursor-pointer">
                                                    {k("branding.replace_logo")}
                                                    <input
                                                        type="file"
                                                        accept="image/png,image/jpeg"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) uploadLogo(file);
                                                            e.target.value = "";
                                                        }}
                                                    />
                                                </label>
                                                <Button size="sm" loading={uploading} onClick={removeLogo}>
                                                    {k("branding.remove_logo")}
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <FileDropzone
                                            multiple={false}
                                            accept="image/png,image/jpeg"
                                            isUploading={uploading}
                                            dropHint={k("branding.logo_drop")}
                                            uploadingLabel={k("branding.logo_uploading")}
                                            sizeHint={k("branding.logo_hint")}
                                            onFilesSelected={(files) => {
                                                const file = files ? Array.from(files)[0] : undefined;
                                                if (file) uploadLogo(file);
                                            }}
                                        />
                                    )}
                                </div>
                                <div className="flex min-w-0 flex-col gap-4">
                                    <div>
                                        <FieldLabel>{k("branding.brand_color")}</FieldLabel>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {BRAND_PRESETS.map((color) => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    aria-label={color}
                                                    aria-pressed={form.brand_color.toLowerCase() === color}
                                                    onClick={() => set("brand_color", color)}
                                                    className="h-7 w-7 rounded-full"
                                                    style={{
                                                        background: color,
                                                        boxShadow:
                                                            form.brand_color.toLowerCase() === color
                                                                ? `0 0 0 2px ${T.WHITE}, 0 0 0 4px ${color}`
                                                                : `0 0 0 1px ${T.BORDER}`,
                                                    }}
                                                />
                                            ))}
                                            <input
                                                id="pds-brand-color"
                                                type="color"
                                                aria-label={k("branding.custom_color")}
                                                {...fieldA11y("pds-brand-color", { error: errors.brand_color })}
                                                value={form.brand_color}
                                                onChange={(e) => set("brand_color", e.target.value)}
                                                className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                                            />
                                            <span className="font-mono text-xs" style={{ color: T.TEXT_MUTED }}>
                                                {form.brand_color}
                                            </span>
                                        </div>
                                        {errors.brand_color && <FieldError id="pds-brand-color-error">{errors.brand_color}</FieldError>}
                                    </div>
                                    <ToggleField
                                        checked={form.bilingual_labels}
                                        onChange={() => set("bilingual_labels", !form.bilingual_labels)}
                                        title={k("branding.bilingual")}
                                        description={k("branding.bilingual_hint")}
                                    />
                                </div>
                            </div>
                        </Section>

                        <Section title={k("numbering.title")} description={k("numbering.description")}>
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                <RangeBlock
                                    title={k("numbering.invoices")}
                                    example={formatNumber(form.invoice_series, form.invoice_number_start || 1, form.number_padding)}
                                    exampleLabel={k("numbering.first_number")}
                                >
                                    <Field htmlFor="pds-invoice-series" label={k("numbering.series")} required error={errors.invoice_series}>
                                        <input id="pds-invoice-series" className="dr-input font-mono" maxLength={10} {...text("invoice_series")} />
                                    </Field>
                                    <Field htmlFor="pds-invoice-start" label={k("numbering.range_start")} required error={errors.invoice_number_start}>
                                        <input id="pds-invoice-start" className="dr-input" min={1} {...integer("invoice_number_start")} />
                                    </Field>
                                    <Field htmlFor="pds-invoice-end" label={k("numbering.range_end")} hint={k("numbering.range_end_hint")} error={errors.invoice_number_end}>
                                        <input id="pds-invoice-end" className="dr-input" min={1} {...integer("invoice_number_end", true)} />
                                    </Field>
                                </RangeBlock>
                                <RangeBlock
                                    title={k("numbering.receipts")}
                                    example={formatNumber(form.receipt_series, form.receipt_number_start || 1, form.number_padding)}
                                    exampleLabel={k("numbering.first_number")}
                                >
                                    <Field htmlFor="pds-receipt-series" label={k("numbering.series")} required error={errors.receipt_series}>
                                        <input id="pds-receipt-series" className="dr-input font-mono" maxLength={10} {...text("receipt_series")} />
                                    </Field>
                                    <Field htmlFor="pds-receipt-start" label={k("numbering.range_start")} required error={errors.receipt_number_start}>
                                        <input id="pds-receipt-start" className="dr-input" min={1} {...integer("receipt_number_start")} />
                                    </Field>
                                    <Field htmlFor="pds-receipt-end" label={k("numbering.range_end")} hint={k("numbering.range_end_hint")} error={errors.receipt_number_end}>
                                        <input id="pds-receipt-end" className="dr-input" min={1} {...integer("receipt_number_end", true)} />
                                    </Field>
                                </RangeBlock>
                            </div>
                            <div className="mt-4 max-w-[220px]">
                                <Field htmlFor="pds-padding" label={k("numbering.padding")} hint={k("numbering.padding_hint")} error={errors.number_padding}>
                                    <input id="pds-padding" className="dr-input" min={1} max={10} {...integer("number_padding")} />
                                </Field>
                            </div>
                        </Section>

                        <Section title={k("tax.title")} description={k("tax.description")}>
                            <Grid>
                                <Field htmlFor="pds-vat-rate" label={k("tax.vat_rate")} hint={k("tax.vat_rate_hint")} required error={errors.vat_rate}>
                                    <div className="relative">
                                        <input
                                            id="pds-vat-rate"
                                            {...fieldA11y("pds-vat-rate", { required: true, error: errors.vat_rate, hint: k("tax.vat_rate_hint") })}
                                            className="dr-input pr-8"
                                            type="number"
                                            min={0}
                                            max={100}
                                            step="0.01"
                                            value={String(form.vat_rate)}
                                            onChange={(e) => set("vat_rate", e.target.value === "" ? 0 : Number(e.target.value))}
                                        />
                                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: T.TEXT_MUTED }}>
                                            %
                                        </span>
                                    </div>
                                </Field>
                                <Field htmlFor="pds-approval" label={k("tax.approval_number")} hint={k("tax.approval_number_hint")} error={errors.approval_number}>
                                    <input id="pds-approval" className="dr-input" {...text("approval_number")} />
                                </Field>
                            </Grid>
                            <div className="mt-4 flex flex-col gap-3">
                                <ToggleField
                                    checked={form.show_stamp_duty}
                                    onChange={() => set("show_stamp_duty", !form.show_stamp_duty)}
                                    title={k("tax.stamp_duty")}
                                    description={k("tax.stamp_duty_hint")}
                                />
                                <ToggleField
                                    checked={form.show_approval_seal}
                                    onChange={() => set("show_approval_seal", !form.show_approval_seal)}
                                    title={k("tax.seal")}
                                    description={k("tax.seal_hint")}
                                />
                            </div>
                        </Section>

                        <Section title={k("payment.title")} description={k("payment.description")}>
                            <Grid>
                                <Field htmlFor="pds-bank" label={k("payment.bank_name")} error={errors.bank_name}>
                                    <input id="pds-bank" className="dr-input" {...text("bank_name")} />
                                </Field>
                                <Field htmlFor="pds-account" label={k("payment.account_name")} error={errors.bank_account_name}>
                                    <input id="pds-account" className="dr-input" {...text("bank_account_name")} />
                                </Field>
                                <Field htmlFor="pds-iban" label="IBAN" error={errors.iban}>
                                    <input id="pds-iban" className="dr-input font-mono" {...text("iban")} />
                                </Field>
                                <Field htmlFor="pds-swift" label="SWIFT / BIC" error={errors.swift}>
                                    <input id="pds-swift" className="dr-input font-mono" {...text("swift")} />
                                </Field>
                                <Field htmlFor="pds-term" label={k("payment.term_days")} hint={k("payment.term_days_hint")} required error={errors.payment_term_days}>
                                    <input id="pds-term" className="dr-input" min={0} max={365} {...integer("payment_term_days")} />
                                </Field>
                            </Grid>
                            <div className="mt-4">
                                <ToggleField
                                    checked={form.show_try_equivalent}
                                    onChange={() => set("show_try_equivalent", !form.show_try_equivalent)}
                                    title={k("payment.try_equivalent")}
                                    description={k("payment.try_equivalent_hint")}
                                />
                            </div>
                        </Section>

                        <Section title={k("footer.title")} description={k("footer.description")}>
                            <textarea
                                id="pds-footer"
                                aria-label={k("footer.title")}
                                {...fieldA11y("pds-footer", { error: errors.footer_note })}
                                className="dr-input"
                                rows={3}
                                placeholder={k("footer.placeholder")}
                                {...text("footer_note")}
                            />
                            {errors.footer_note && <FieldError id="pds-footer-error">{errors.footer_note}</FieldError>}
                        </Section>
                    </div>

                    <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
                        <Card>
                            <SectionLabel>{k("side.numbering")}</SectionLabel>
                            <Deferred data="numbering" fallback={<NumberingSkeleton />}>
                                <NumberingSummary numbering={liveNumbering} k={k} />
                            </Deferred>
                        </Card>
                        <Card>
                            <SectionLabel>{k("side.preview")}</SectionLabel>
                            <p className="mb-3 text-xs leading-relaxed" style={{ color: T.TEXT_MUTED }}>
                                {k("side.preview_hint")}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" disabled={!settings.saved} onClick={() => openPreview("invoice")}>
                                    {k("side.preview_invoice")}
                                </Button>
                                <Button size="sm" disabled={!settings.saved} onClick={() => openPreview("receipt")}>
                                    {k("side.preview_receipt")}
                                </Button>
                            </div>
                        </Card>
                        <div
                            className="rounded-[10px] p-3 text-xs leading-relaxed"
                            style={{ background: T.AMBER_BG, border: `1px solid ${T.AMBER_BORDER}`, color: T.AMBER_TEXT }}
                        >
                            {k("side.issued_note")}
                        </div>
                    </aside>
                </div>
            </div>

            {dirty && (
                <div
                    className="fixed inset-x-0 bottom-0 z-[50] flex items-center justify-end gap-3 px-6 py-3"
                    style={{ background: T.WHITE, borderTop: `1px solid ${T.BORDER}`, boxShadow: "0 -4px 16px rgba(17, 24, 39, 0.06)" }}
                >
                    <span className="mr-auto text-[13px]" style={{ color: T.TEXT_MUTED }}>
                        {settings.saved ? k("unsaved") : k("not_saved_yet")}
                    </span>
                    {settings.saved && (
                        <Button onClick={onReset} disabled={saving}>
                            {k("discard")}
                        </Button>
                    )}
                    <Button variant="primary" loading={saving} onClick={onSave}>
                        {k("save")}
                    </Button>
                </div>
            )}
        </PageLayout>
    );
}

PaymentDocumentSettingsPage.layout = (page: ReactNode) => <DashboardLayout>{page}</DashboardLayout>;

function Card({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-[12px] p-4" style={{ background: T.WHITE, border: `1px solid ${T.BORDER}` }}>
            {children}
        </div>
    );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
    return (
        <section className="rounded-[12px] p-5" style={{ background: T.WHITE, border: `1px solid ${T.BORDER}` }}>
            <h2 className="text-[15px] font-semibold" style={{ color: T.TEXT }}>
                {title}
            </h2>
            <p className="mb-4 mt-0.5 text-xs leading-relaxed" style={{ color: T.TEXT_MUTED }}>
                {description}
            </p>
            {children}
        </section>
    );
}

function Grid({ children }: { children: ReactNode }) {
    return <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">{children}</div>;
}

function FieldLabel({ children, required, htmlFor }: { children: ReactNode; required?: boolean; htmlFor?: string }) {
    const content = (
        <>
            {children}
            {required && <span style={{ color: T.RED }}> *</span>}
        </>
    );

    return htmlFor ? (
        <label htmlFor={htmlFor} className="dr-label mb-1.5 block">
            {content}
        </label>
    ) : (
        <div className="dr-label mb-1.5">{content}</div>
    );
}

function FieldError({ id, children }: { id?: string; children: ReactNode }) {
    return (
        <div id={id} className="mt-1 text-xs" style={{ color: T.RED }}>
            {children}
        </div>
    );
}

/** Required and error state for a control that Field cannot reach. */
function fieldA11y(id: string, { required, error, hint }: { required?: boolean; error?: string; hint?: string }) {
    return {
        "aria-required": required || undefined,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
    } as const;
}

function Field({
    htmlFor,
    label,
    hint,
    error,
    required,
    wide,
    children,
}: {
    htmlFor: string;
    label: string;
    hint?: string;
    error?: string;
    required?: boolean;
    wide?: boolean;
    children: ReactNode;
}) {
    const messageId = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
    // When the child is the control itself, give it its required and error
    // state so screen readers announce them with the field. A wrapped control
    // sets these itself (see fieldA11y).
    const control = isValidElement(children) && ["input", "textarea", "select"].includes(children.type as string)
        ? cloneElement(children as ReactElement<Record<string, unknown>>, {
              "aria-required": required || undefined,
              "aria-invalid": error ? true : undefined,
              "aria-describedby": messageId,
          })
        : children;

    return (
        <div className={`min-w-0 ${wide ? "md:col-span-2" : ""}`}>
            <FieldLabel htmlFor={htmlFor} required={required}>{label}</FieldLabel>
            {control}
            {error ? (
                <FieldError id={messageId}>{error}</FieldError>
            ) : hint ? (
                <div id={messageId} className="mt-1 text-xs" style={{ color: T.TEXT_HINT }}>
                    {hint}
                </div>
            ) : null}
        </div>
    );
}

function RangeBlock({
    title,
    example,
    exampleLabel,
    children,
}: {
    title: string;
    example: string;
    exampleLabel: string;
    children: ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-3 rounded-[10px] p-4" style={{ background: T.SURFACE_2, border: `1px solid ${T.BORDER_SOFT}` }}>
            <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold" style={{ color: T.TEXT }}>
                    {title}
                </span>
                <span className="text-xs" style={{ color: T.TEXT_MUTED }}>
                    {exampleLabel} <span className="font-mono font-semibold" style={{ color: T.TEXT }}>№ {example}</span>
                </span>
            </div>
            {children}
        </div>
    );
}

function NumberingSkeleton() {
    return (
        <div className="flex flex-col gap-3">
            {[0, 1].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg" style={{ background: T.SKELETON }} />
            ))}
        </div>
    );
}

function NumberingSummary({
    numbering,
    k,
}: {
    numbering: Numbering | null;
    k: (key: string, params?: Record<string, string | number>) => string;
}) {
    if (!numbering) return <NumberingSkeleton />;

    const rows: Array<{ kind: DocumentKind; label: string }> = [
        { kind: "invoice", label: k("numbering.invoices") },
        { kind: "receipt", label: k("numbering.receipts") },
    ];

    return (
        <div className="flex flex-col gap-3">
            {rows.map(({ kind, label }) => {
                const state = numbering[kind];
                const low = state.remaining !== null && state.remaining > 0 && state.remaining <= 50;
                return (
                    <div key={kind} className="rounded-lg p-3" style={{ background: T.SURFACE_2, border: `1px solid ${T.BORDER_SOFT}` }}>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-semibold" style={{ color: T.TEXT }}>
                                {label}
                            </span>
                            {state.next === null ? (
                                <Badge variant="red">{k("side.range_used_up")}</Badge>
                            ) : low ? (
                                <Badge variant="amber">{k("side.remaining", { count: state.remaining ?? 0 })}</Badge>
                            ) : null}
                        </div>
                        <div className="mt-1 text-xs" style={{ color: T.TEXT_MUTED }}>
                            {state.next !== null ? (
                                <>
                                    {k("side.next")}{" "}
                                    <span className="font-mono font-semibold" style={{ color: T.TEXT }}>
                                        № {state.next}
                                    </span>
                                </>
                            ) : (
                                k("side.range_used_up_hint")
                            )}
                        </div>
                        <div className="mt-0.5 text-xs" style={{ color: T.TEXT_HINT }}>
                            {k("side.issued", { count: state.issued })}
                            {state.remaining !== null && state.next !== null && !low
                                ? ` · ${k("side.remaining", { count: state.remaining })}`
                                : ""}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
