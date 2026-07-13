import type {
    LeadQualification,
    LeadQualificationsResponse,
    QualificationStatus,
} from "@/Types/qualification";

interface LegacyQualificationsIndexResponse {
    qualifications?: LeadQualification[];
}

type QualificationsIndexResponse =
    | LeadQualificationsResponse
    | LegacyQualificationsIndexResponse;

const isQualificationStatus = (
    value: unknown,
): value is QualificationStatus =>
    value === "inProgress" || value === "completed" || value === "abandoned";

const pickCurrentQualification = (
    qualifications: LeadQualification[],
): LeadQualification | null => {
    const inProgress = qualifications.find(
        (qualification) => qualification.status === "inProgress",
    );
    if (inProgress) {
        return inProgress;
    }

    const completed = qualifications.find(
        (qualification) => qualification.status === "completed",
    );
    if (completed) {
        return completed;
    }

    return qualifications[0] ?? null;
};

export const normalizeQualificationsIndexResponse = (
    payload: QualificationsIndexResponse,
): LeadQualificationsResponse => {
    if (
        Object.prototype.hasOwnProperty.call(payload, "current") ||
        Object.prototype.hasOwnProperty.call(payload, "history")
    ) {
        const response = payload as LeadQualificationsResponse;

        return {
            current: response.current ?? null,
            history: response.history ?? [],
        };
    }

    const qualifications = Array.isArray(
        (payload as LegacyQualificationsIndexResponse).qualifications,
    )
        ? (payload as LegacyQualificationsIndexResponse).qualifications!
        : [];

    const current = pickCurrentQualification(qualifications);

    return {
        current,
        history: qualifications.filter(
            (qualification) => !current || qualification.id !== current.id,
        ),
    };
};

export const isLeadQualification = (
    value: unknown,
): value is LeadQualification => {
    if (!value || typeof value !== "object") {
        return false;
    }

    const record = value as Partial<LeadQualification>;

    return (
        typeof record.id === "number" &&
        typeof record.lead_id === "number" &&
        typeof record.template_id === "string" &&
        isQualificationStatus(record.status)
    );
};
