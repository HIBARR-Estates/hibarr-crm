import dayjs, { Dayjs } from "dayjs";

export type AgeRangeValue =
    | "under 20"
    | "20-25"
    | "26-30"
    | "31-40"
    | "41-50"
    | "51-65"
    | "above 66";

export function computeAgeFromDateOfBirth(
    dateOfBirth: string | Dayjs | null | undefined,
): number | null {
    if (!isValidDateOfBirth(dateOfBirth)) {
        return null;
    }

    const dob = dayjs(dateOfBirth);
    const age = dayjs().diff(dob, "year");

    return age >= 0 ? age : null;
}

export function isValidDateOfBirth(
    dateOfBirth: string | Dayjs | null | undefined,
): boolean {
    if (!dateOfBirth) {
        return false;
    }

    return dayjs(dateOfBirth).isValid();
}

export function computeAgeRangeFromAge(
    age: number | null | undefined,
): AgeRangeValue | null {
    if (age == null || age < 0) {
        return null;
    }

    if (age < 20) {
        return "under 20";
    }

    if (age <= 25) {
        return "20-25";
    }

    if (age <= 30) {
        return "26-30";
    }

    if (age <= 40) {
        return "31-40";
    }

    if (age <= 50) {
        return "41-50";
    }

    if (age <= 65) {
        return "51-65";
    }

    return "above 66";
}

export function computeAgeFieldsFromDateOfBirth(
    dateOfBirth: string | Dayjs | null | undefined,
): { age: number | null; age_range: AgeRangeValue | null } {
    const age = computeAgeFromDateOfBirth(dateOfBirth);

    return {
        age,
        age_range: computeAgeRangeFromAge(age),
    };
}

export interface LeadAgeFieldVisibility {
    showDateOfBirth: boolean;
    showAge: boolean;
    showAgeRange: boolean;
    ageAndRangeReadOnly: boolean;
}

export function getLeadAgeFieldVisibility(params: {
    dateOfBirth?: string | null;
    age?: number | null;
    ageRange?: string | null;
}): LeadAgeFieldVisibility {
    const hasDob = isValidDateOfBirth(params.dateOfBirth);
    const hasAge = params.age != null;

    if (hasDob) {
        return {
            showDateOfBirth: true,
            showAge: false,
            showAgeRange: false,
            ageAndRangeReadOnly: true,
        };
    }

    if (hasAge) {
        return {
            showDateOfBirth: false,
            showAge: true,
            showAgeRange: true,
            ageAndRangeReadOnly: false,
        };
    }

    return {
        showDateOfBirth: true,
        showAge: true,
        showAgeRange: true,
        ageAndRangeReadOnly: false,
    };
}

export function resolveLeadAgeFields(params: {
    dateOfBirth?: string | null;
    age?: number | null;
    ageRange?: string | null;
}): {
    dateOfBirth: string | null;
    age: number | null;
    ageRange: AgeRangeValue | string | null;
} {
    if (isValidDateOfBirth(params.dateOfBirth)) {
        const computed = computeAgeFieldsFromDateOfBirth(params.dateOfBirth);

        return {
            dateOfBirth: params.dateOfBirth ?? null,
            age: computed.age,
            ageRange: computed.age_range,
        };
    }

    return {
        dateOfBirth: null,
        age: params.age ?? null,
        ageRange: params.ageRange ?? null,
    };
}

export function formatAgeRangeDisplay(
    value: string | null | undefined,
    labelResolver?: (value: string) => string,
): string {
    if (!value) {
        return "";
    }

    const label = labelResolver ? labelResolver(value) : value;

    return label.replace(/(\d+)\s*-\s*(\d+)/g, "$1–$2");
}

export function formatLeadAgeDisplay(
    fields: {
        dateOfBirth: string | null;
        age: number | null;
        ageRange: AgeRangeValue | string | null;
    },
    resolveAgeRangeLabel?: (value: string) => string,
): string | null {
    const hasDob = isValidDateOfBirth(fields.dateOfBirth);
    const hasAge = fields.age != null;

    if (hasDob || hasAge) {
        const dateLabel = hasDob
            ? dayjs(fields.dateOfBirth).format("DD MMM YYYY")
            : null;
        const ageLabel = hasAge ? `${fields.age} yrs old` : null;

        if (dateLabel && ageLabel) {
            return `${dateLabel} • ${ageLabel}`;
        }

        if (dateLabel) {
            return dateLabel;
        }

        if (ageLabel) {
            return ageLabel;
        }
    }

    if (fields.ageRange) {
        return `Range: ${formatAgeRangeDisplay(
            String(fields.ageRange),
            resolveAgeRangeLabel,
        )}`;
    }

    return null;
}

export function hasLeadAgeData(fields: {
    dateOfBirth: string | null;
    age: number | null;
    ageRange: AgeRangeValue | string | null;
}): boolean {
    return !!(
        isValidDateOfBirth(fields.dateOfBirth) ||
        fields.age != null ||
        fields.ageRange
    );
}
