export type AnalysisFieldType =
    | 'text'
    | 'date'
    | 'textarea'
    | 'boolean'
    | 'number'
    | 'phone'
    | 'country'
    | 'select'
    | 'radio'
    | 'multiselect';

export type AnalysisUpdateType = 'details' | 'hibarr_field' | 'contact';
export type AnalysisFieldSource = 'deal' | 'hibarrFields' | 'contact';

export interface AnalysisFieldMeta {
    label: string;
    fieldType: AnalysisFieldType;
    updateType: AnalysisUpdateType;
    source: AnalysisFieldSource;
}

export const ANALYSIS_FIELD_META: Record<string, AnalysisFieldMeta> = {
    // Native deal fields
    name:              { label: 'Deal Name',          fieldType: 'text',       updateType: 'details',      source: 'deal' },
    close_date:        { label: 'Close Date',          fieldType: 'date',       updateType: 'details',      source: 'deal' },
    value:             { label: 'Deal Value',          fieldType: 'text',       updateType: 'details',      source: 'deal' },
    category_id:       { label: 'Deal Category',       fieldType: 'text',       updateType: 'details',      source: 'deal' },

    // Hibarr fields
    interested_in:            { label: 'Interested In',           fieldType: 'text',     updateType: 'hibarr_field', source: 'hibarrFields' },
    motivation:               { label: 'Motivation',              fieldType: 'textarea', updateType: 'hibarr_field', source: 'hibarrFields' },
    purchase_timeline:        { label: 'Purchase Timeline',       fieldType: 'text',     updateType: 'hibarr_field', source: 'hibarrFields' },
    budget_range:             { label: 'Budget Range',            fieldType: 'text',     updateType: 'hibarr_field', source: 'hibarrFields' },
    inspection_trip_date:     { label: 'Inspection Trip Date',    fieldType: 'date',     updateType: 'hibarr_field', source: 'hibarrFields' },
    strategy_meeting_booked:  { label: 'Strategy Meeting Booked', fieldType: 'boolean',  updateType: 'hibarr_field', source: 'hibarrFields' },
    downpayment_paid:         { label: 'Downpayment Paid',        fieldType: 'boolean',  updateType: 'hibarr_field', source: 'hibarrFields' },

    // Lead / contact fields
    client_name:   { label: 'Full Name',     fieldType: 'text',       updateType: 'contact', source: 'contact' },
    client_email:  { label: 'Email',         fieldType: 'text',       updateType: 'contact', source: 'contact' },
    mobile:        { label: 'Mobile',        fieldType: 'phone',      updateType: 'contact', source: 'contact' },
    cell:          { label: 'Cell',          fieldType: 'phone',      updateType: 'contact', source: 'contact' },
    office:        { label: 'Office Phone',  fieldType: 'phone',      updateType: 'contact', source: 'contact' },
    company_name:  { label: 'Company',       fieldType: 'text',       updateType: 'contact', source: 'contact' },
    address:       { label: 'Address',       fieldType: 'text',       updateType: 'contact', source: 'contact' },
    city:          { label: 'City',          fieldType: 'text',       updateType: 'contact', source: 'contact' },
    state:         { label: 'State',         fieldType: 'text',       updateType: 'contact', source: 'contact' },
    country:       { label: 'Country',       fieldType: 'country',    updateType: 'contact', source: 'contact' },
    postal_code:   { label: 'Postal Code',   fieldType: 'text',       updateType: 'contact', source: 'contact' },

    // Promoted core contact fields — editable
    gender:        { label: 'Gender',         fieldType: 'select',     updateType: 'contact', source: 'contact' },
    date_of_birth: { label: 'Date of Birth',  fieldType: 'date',       updateType: 'contact', source: 'contact' },
    age:           { label: 'Age',            fieldType: 'number',     updateType: 'contact', source: 'contact' },
    nationality:   { label: 'Nationality',    fieldType: 'country',    updateType: 'contact', source: 'contact' },
    occupation:    { label: 'Occupation',     fieldType: 'text',       updateType: 'contact', source: 'contact' },
    languages:     { label: 'Languages',      fieldType: 'multiselect',updateType: 'contact', source: 'contact' },
};

// Core contact fields shown in Personal Info (in display order).
// Read-only keys have no edit type in ANALYSIS_FIELD_META (relation lookups).
export const PERSONAL_INFO_KEYS = [
    'client_name',
    'client_email',
    'mobile',
    'cell',
    'office',
    'gender',
    'date_of_birth',
    'age',
    'nationality',
    'occupation',
    'languages',
    'company_name',
    'address',
    'city',
    'state',
    'country',
    'postal_code',
] as const;

// Relation fields rendered in Personal Info but NOT editable here.
export const READ_ONLY_CONTACT_KEYS = new Set([
    'leadSource',
    'category',
    'leadOwner',
    'lifecycleStatus',
]);
