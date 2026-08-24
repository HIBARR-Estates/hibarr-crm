import { useEffect, useState } from "react";
import { Modal, Button, Radio, Skeleton, Alert, Tag } from "antd";
import { router } from "@inertiajs/react";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { formatMobileForDisplay } from "@/lib/utils";
import Badge from "@/Components/Redesign/primitives/Badge";
import type { IModalProps } from "@/Types/common";
import type {
    LeadMergeReviewResponse,
    LeadMergeSummary,
} from "@/Types/api/lead-merge";
import type { LeadContactMethod } from "@/Types/api/leads";

interface Props extends IModalProps {
    primaryId: number;
    duplicateId: number;
}

const CONTACT_FIELD_LABELS: Record<string, string> = {
    client_email: "Email",
    mobile: "Mobile",
    cell: "Cell",
    office: "Office",
    company_name: "Company",
    address: "Address",
    client_whatsapp: "WhatsApp",
    client_telegram: "Telegram",
    client_instagram: "Instagram",
};

const PHONE_CONTACT_FIELDS = new Set([
    "mobile",
    "cell",
    "office",
    "client_whatsapp",
]);

function displayContactValue(field: string, value: unknown): string {
    if (value == null || value === "") return "—";
    if (PHONE_CONTACT_FIELDS.has(field)) {
        return formatMobileForDisplay(value) || "—";
    }
    return String(value);
}

function formatContactMethodValue(method: LeadContactMethod): string {
    return method.type === "phone"
        ? formatMobileForDisplay(method.identifier) || method.identifier
        : method.identifier;
}

/** Union of both leads' contact methods, deduped by type+normalized — what the merged lead will end up with. */
function unionContactMethods(
    primary: LeadContactMethod[],
    duplicate: LeadContactMethod[],
): LeadContactMethod[] {
    const byKey = new Map<string, LeadContactMethod>();

    [...primary, ...duplicate].forEach((method) => {
        const key = `${method.type}:${method.normalized}`;
        const existing = byKey.get(key);
        if (!existing || (method.is_main && !existing.is_main)) {
            byKey.set(key, method);
        }
    });

    return Array.from(byKey.values());
}

const OWNERSHIP_LABELS: Record<string, string> = {
    lead_owner: "Lead Owner",
    added_by: "Added By",
    client_id: "Client",
    agent_id: "Agent",
};

const COUNT_LABELS: Record<string, string> = {
    deals: "Deals",
    notes: "Notes",
    follow_ups: "Follow-ups",
    qualifications: "Qualifications",
    communication_activities: "Communication Activities",
    tasks: "Tasks",
    flight_itineraries: "Flight Itineraries",
};

const LeadSummaryColumn: React.FC<{
    label: string;
    summary: LeadMergeSummary;
    conflicts: LeadMergeReviewResponse["contact_conflicts"];
}> = ({ label, summary, conflicts }) => {
    const { td } = useTd();

    return (
        <div className="rounded-lg border border-[#eef1f5] p-3">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-gray-500">
                    {label}
                </span>
                <span className="text-sm font-semibold">
                    {summary.client_name}
                </span>
            </div>
            <dl className="space-y-1 text-sm">
                {Object.entries(CONTACT_FIELD_LABELS).map(
                    ([field, fieldLabel]) => {
                        const value = (
                            summary as unknown as Record<string, unknown>
                        )[field] as string | null;
                        const conflict = conflicts[field];
                        const isConflict = Boolean(conflict);

                        return (
                            <div key={field} className="flex justify-between gap-2">
                                <dt className="text-gray-500">{td(fieldLabel, { source: "en" })}</dt>
                                <dd
                                    className={
                                        isConflict
                                            ? "font-medium text-amber-600"
                                            : "text-gray-800"
                                    }
                                >
                                    {displayContactValue(field, value)}
                                    {isConflict && (
                                        <Tag color="warning" className="ml-1">
                                            {td("differs", { source: "en" })}
                                        </Tag>
                                    )}
                                </dd>
                            </div>
                        );
                    },
                )}
            </dl>
            {summary.contact_methods.some((method) => !method.is_main) && (
                <div className="mt-2 border-t border-[#f0f0f0] pt-2">
                    <span className="text-xs text-gray-500">
                        {td("Additional contact points", { source: "en" })}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                        {summary.contact_methods
                            .filter((method) => !method.is_main)
                            .map((method) => (
                                <Badge key={method.id} variant="gray">
                                    {formatContactMethodValue(method)}
                                </Badge>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function LeadMergeReviewModal({
    open,
    primaryId,
    duplicateId,
    onClose,
}: Props) {
    const { td } = useTd();
    const [picks, setPicks] = useState<Record<string, number>>({});

    useEffect(() => {
        if (open) {
            setPicks({});
        }
    }, [open, primaryId, duplicateId]);

    const { data, isLoading, isError } = useApiQuery<LeadMergeReviewResponse>({
        path: route("lead-contact.merge-review", {
            lead: primaryId,
            duplicate: duplicateId,
        }),
        options: { enabled: open },
    });

    const { mutate: confirmMerge, status } = useApiMutate<
        Record<string, number>,
        any,
        ApiResponse<any>
    >(route("lead-contact.merge", primaryId), "POST");

    const ownershipFields = data?.ownership_fields ?? [];
    const pendingFields = ownershipFields.filter(
        (field) =>
            field.differs &&
            field.primary_value === null &&
            picks[field.field] === undefined,
    );
    const canConfirm = Boolean(data?.primary) && pendingFields.length === 0;

    const handleConfirm = () => {
        const payload: Record<string, number> = { duplicate_id: duplicateId };

        ownershipFields.forEach((field) => {
            if (!field.differs) return;
            const value = picks[field.field] ?? field.primary_value;
            if (value !== null && value !== undefined) {
                payload[field.field] = value;
            }
        });

        confirmMerge(payload, {
            onSuccess: () => {
                onClose(true);
                router.reload({ only: ["leads", "lead"] });
            },
        });
    };

    return (
        <Modal
            open={open}
            onCancel={() => onClose()}
            width={860}
            title={td("Review lead merge", { source: "en" })}
            destroyOnClose
            footer={[
                <Button key="cancel" onClick={() => onClose()}>
                    {td("Cancel", { source: "en" })}
                </Button>,
                <Button
                    key="confirm"
                    type="primary"
                    danger
                    loading={status === "pending"}
                    disabled={!canConfirm}
                    onClick={handleConfirm}
                >
                    {td("Confirm merge", { source: "en" })}
                </Button>,
            ]}
        >
            {isLoading && <Skeleton active />}
            {(isError || (data && !data.primary)) && (
                <Alert
                    type="error"
                    showIcon
                    message={
                        (data as unknown as { message?: string })?.message ??
                        td("Could not load merge review.", { source: "en" })
                    }
                />
            )}
            {data?.primary && data.duplicate && (
                <div className="flex flex-col gap-4">
                    <Alert
                        type="warning"
                        showIcon
                        message={`${td("Lead", { source: "en" })} #${duplicateId} (${data.duplicate.client_name}) ${td("will be discarded — its records move to", { source: "en" })} ${td("lead", { source: "en" })} #${primaryId} (${data.primary.client_name}).`}
                    />

                    {(() => {
                        const merged = unionContactMethods(
                            data.primary.contact_methods,
                            data.duplicate.contact_methods,
                        );
                        const emailCount = merged.filter(
                            (m) => m.type === "email",
                        ).length;
                        const phoneCount = merged.filter(
                            (m) => m.type === "phone",
                        ).length;

                        return (
                            <Alert
                                type="info"
                                showIcon
                                message={`${td("After merging, the kept lead will have", { source: "en" })} ${emailCount} ${td("email(s) and", { source: "en" })} ${phoneCount} ${td("phone number(s) across both leads.", { source: "en" })}`}
                            />
                        );
                    })()}

                    <div className="grid grid-cols-2 gap-4">
                        <LeadSummaryColumn
                            label={`A · ${td("Primary (keep)", { source: "en" })}`}
                            summary={data.primary}
                            conflicts={data.contact_conflicts}
                        />
                        <LeadSummaryColumn
                            label={`B · ${td("Duplicate (discard)", { source: "en" })}`}
                            summary={data.duplicate}
                            conflicts={data.contact_conflicts}
                        />
                    </div>

                    <div>
                        <h4 className="mb-2 text-sm font-semibold">
                            {td("Connected records", { source: "en" })}
                        </h4>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-500">
                                    <th className="pb-1 font-normal">
                                        {td("Record type", { source: "en" })}
                                    </th>
                                    <th className="pb-1 font-normal">
                                        A · {td("Primary", { source: "en" })}
                                    </th>
                                    <th className="pb-1 font-normal">
                                        B · {td("Duplicate", { source: "en" })}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(COUNT_LABELS).map(
                                    ([key, countLabel]) => (
                                        <tr
                                            key={key}
                                            className="border-t border-[#f0f0f0]"
                                        >
                                            <td className="py-1">
                                                {td(countLabel, { source: "en" })}
                                            </td>
                                            <td className="py-1">
                                                {
                                                    data.counts.primary[
                                                        key as keyof typeof data.counts.primary
                                                    ]
                                                }
                                            </td>
                                            <td className="py-1">
                                                {
                                                    data.counts.duplicate[
                                                        key as keyof typeof data.counts.duplicate
                                                    ]
                                                }
                                            </td>
                                        </tr>
                                    ),
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div>
                        <h4 className="mb-2 text-sm font-semibold">
                            {td("Ownership", { source: "en" })}
                        </h4>
                        <div className="flex flex-col gap-2">
                            {ownershipFields.map((field) => (
                                <div
                                    key={field.field}
                                    className="flex items-center justify-between gap-4 border-b border-[#f0f0f0] py-2 last:border-0"
                                >
                                    <span className="text-sm text-gray-600">
                                        {td(OWNERSHIP_LABELS[field.field], { source: "en" })}
                                    </span>
                                    {field.differs ? (
                                        <Radio.Group
                                            value={
                                                picks[field.field] ??
                                                field.primary_value ??
                                                undefined
                                            }
                                            onChange={(e) =>
                                                setPicks((prev) => ({
                                                    ...prev,
                                                    [field.field]: e.target.value,
                                                }))
                                            }
                                        >
                                            {field.primary_value !== null && (
                                                <Radio value={field.primary_value}>
                                                    {field.primary_label ??
                                                        field.primary_value}{" "}
                                                    (A)
                                                </Radio>
                                            )}
                                            {field.duplicate_value !== null && (
                                                <Radio value={field.duplicate_value}>
                                                    {field.duplicate_label ??
                                                        field.duplicate_value}{" "}
                                                    (B)
                                                </Radio>
                                            )}
                                        </Radio.Group>
                                    ) : (
                                        <span className="text-sm">
                                            {field.primary_label ??
                                                field.primary_value ??
                                                "—"}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
}
