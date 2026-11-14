export interface PaymentDocumentSettings {
    saved: boolean;
    legal_name: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    tax_office: string | null;
    tax_number: string | null;
    registration_number: string | null;
    logo_url: string | null;
    brand_color: string;
    invoice_series: string;
    invoice_number_start: number;
    invoice_number_end: number | null;
    receipt_series: string;
    receipt_number_start: number;
    receipt_number_end: number | null;
    number_padding: number;
    vat_rate: number;
    approval_number: string | null;
    show_stamp_duty: boolean;
    show_approval_seal: boolean;
    bank_name: string | null;
    bank_account_name: string | null;
    iban: string | null;
    swift: string | null;
    payment_term_days: number;
    show_try_equivalent: boolean;
    bilingual_labels: boolean;
    footer_note: string | null;
}

/** What the form edits: everything except the read-only flags and the logo, which uploads on its own. */
export type PaymentDocumentSettingsForm = Omit<PaymentDocumentSettings, "saved" | "logo_url">;

export type DocumentKind = "invoice" | "receipt";

export interface NumberingState {
    /** Null when the configured range is used up. */
    next: string | null;
    /** Null when the range has no end. */
    remaining: number | null;
    issued: number;
}

export type Numbering = Record<DocumentKind, NumberingState>;
