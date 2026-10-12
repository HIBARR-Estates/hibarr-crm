import { ReactNode, useMemo, useState } from "react";
import { message } from "antd";
import type { Deal } from "@/Types/api/deals";
import type { DealFile } from "@/Types/api/file";
import useTranslation from "@/Hooks/useTranslation";
import useClickToCall from "@/Hooks/useClickToCall";
import { copyToClipboard, resolveLeadPhoneDisplay } from "@/lib/utils";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { DealTab } from "../../../types";
import useDealDocuments from "../../../hooks/useDealDocuments";
import useDealDocumentUpload from "../../../hooks/useDealDocumentUpload";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import Icon from "@/Components/Redesign/primitives/Icon";
import DealDocumentSlotRow from "../DealDocumentSlotRow";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import PackagePropertyManager from "./PackagePropertyManager";
import DealPaymentPanel from "../DealPaymentPanel";
import { initialsFromName } from "../../../adapters/initials";

interface WorkspaceContextRailProps {
    deal: Deal;
    /** undefined = deferred files still pending (C4) */
    files?: DealFile[];
    fields?: Array<{
        id: number;
        label?: string;
        name?: string;
        type?: string;
        custom_field_category_id?: string | number;
    }>;
    /** Pipeline-linked categories — scopes which custom file fields show. */
    categoryIds?: number[];
    /** Field visibility (deal-context-aware) — see useDealDocuments. */
    visibilityMap?: Record<number, boolean>;
    restrictPackageOrProperty?: boolean;
    onNavigateToSubTab: (tab: DealTab) => void;
    onSwitchToDealInfo: () => void;
    showOnlinePayment?: boolean;
    canCreatePaymentRequest?: boolean;
    canConfirmPaymentTransfer?: boolean;
}

const SECTION_TITLE_KEYS: Record<string, string> = {
    Lead: "section_lead",
    "Deal details": "section_deal_details",
    Payment: "section_payment",
    Documents: "section_documents",
};

/**
 * v2.2 Dossier (deal-v2-2.jsx:3643-3775): a single sticky panel with three
 * collapsible sections — Lead / Deal details / Documents. Every field is a
 * read/navigate affordance backed by real deal data.
 */
export default function WorkspaceContextRail({
    deal,
    files,
    fields = [],
    categoryIds,
    visibilityMap,
    restrictPackageOrProperty = false,
    onNavigateToSubTab,
    onSwitchToDealInfo,
    showOnlinePayment = false,
    canCreatePaymentRequest = false,
    canConfirmPaymentTransfer = false,
}: WorkspaceContextRailProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState<Set<string>>(
        () => new Set(["Lead", "Deal details"]),
    );
    const [emailCopied, setEmailCopied] = useState(false);
    const { slots } = useDealDocuments(
        deal,
        files ?? [],
        fields,
        categoryIds,
        visibilityMap,
    );
    // Dossier only shows this deal's own file-type custom fields — lead-owned
    // fields cross-populated here (source: "lead") stay in the Files tab's
    // "Personal files" section, not the dossier.
    const documentSlots = useMemo(
        () => slots.filter((doc) => doc.source !== "lead"),
        [slots],
    );
    const { td } = useTd();
    const {
        uploadToSlot,
        deleteSlot,
        isUploadingField,
        isDeletingField,
        canEdit,
    } = useDealDocumentUpload();

    const toggle = (title: string) =>
        setOpen((prev) => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title);
            else next.add(title);
            return next;
        });

    const contact = deal.contact;
    const leadName =
        contact?.client_name_salutation ||
        contact?.client_name ||
        t("pages.deals.dossier.unknown_lead");
    const email = contact?.client_email || null;
    const phone =
        resolveLeadPhoneDisplay(
            contact?.mobile,
            contact?.mobile_with_phonecode,
        ) ||
        resolveLeadPhoneDisplay(contact?.cell) ||
        "";
    const { isEnabled: clickToCallEnabled, initiateCall, isCalling } =
        useClickToCall();
    const dealCallEntity = { type: "deal" as const, id: deal.id };
    const leadUrl = contact?.id ? route("lead-contact.show", contact.id) : null;
    const leadSource = contact?.lead_source?.type || null;
    // Match Lead header: only show a custom uploaded avatar (not Gravatar).
    const leadPhotoUrl =
        contact?.image && contact?.image_url ? contact.image_url : null;

    const copyEmail = async () => {
        if (!email) return;
        try {
            await copyToClipboard(email);
            setEmailCopied(true);
            message.success(t("pages.deals.dossier.messages.email_copied"));
            window.setTimeout(() => setEmailCopied(false), 2000);
        } catch {
            message.error(t("pages.deals.dossier.messages.copy_failed"));
        }
    };

    const packageSummary =
        deal.packages?.map((pkg) => pkg.name).filter(Boolean).join(", ") ||
        (deal.products?.length
            ? `${deal.products.length} ${
                  deal.products.length === 1
                      ? t("pages.deals.dossier.property_singular")
                      : t("pages.deals.dossier.property_plural")
              }`
            : t("pages.deals.dossier.no_package"));

    const sections: Array<{
        title: string;
        summary: string;
        body: ReactNode;
    }> = useMemo(
        () => [
            {
                title: "Lead",
                summary: leadName,
                body: (
                    <>
                        <a
                            href={leadUrl ?? "#"}
                            className="mb-2.5 flex items-center gap-2.5 text-inherit no-underline"
                        >
                            <Avatar
                                size={34}
                                initials={initialsFromName(leadName)}
                                src={leadPhotoUrl}
                            />
                            <div>
                                <div className="text-sm font-semibold text-dr-text">
                                    {leadName}
                                </div>
                                <div className="text-xs text-dr-text-muted">
                                    {t("pages.deals.dossier.lead_contact")}
                                </div>
                            </div>
                        </a>
                        {email && (
                            <button
                                type="button"
                                onClick={copyEmail}
                                className="flex w-full cursor-pointer items-center gap-1.5 rounded px-0 py-2 text-left text-xs text-dr-text-muted hover:bg-dr-gray"
                            >
                                <Icon name="mail" size={12} />
                                <span className="min-w-0 flex-1 truncate">{email}</span>
                                <span
                                    className="ml-auto flex items-center gap-1 text-[12px] font-semibold"
                                    style={{ color: emailCopied ? T.GREEN : T.BLUE }}
                                >
                                    {emailCopied
                                        ? t("pages.deals.dossier.copied")
                                        : t("pages.deals.dossier.copy")}
                                </span>
                            </button>
                        )}
                        {phone && (
                            clickToCallEnabled ? (
                                <button
                                    type="button"
                                    disabled={isCalling(phone, dealCallEntity)}
                                    onClick={() =>
                                        void initiateCall(phone, dealCallEntity)
                                    }
                                    className="flex w-full cursor-pointer items-center gap-1.5 rounded px-0 py-2 text-left text-xs text-dr-text-muted hover:bg-dr-gray disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Icon name="phone" size={12} />
                                    <span className="min-w-0 flex-1 truncate">
                                        {phone}
                                    </span>
                                    <span
                                        className="ml-auto text-[12px] font-semibold"
                                        style={{ color: T.BLUE }}
                                    >
                                        {t("pages.deals.dossier.call")}
                                    </span>
                                </button>
                            ) : (
                                <div className="flex items-center gap-1.5 rounded px-0 py-2 text-xs text-dr-text-muted">
                                    <Icon name="phone" size={12} />
                                    <span className="min-w-0 flex-1 truncate">
                                        {phone}
                                    </span>
                                </div>
                            )
                        )}
                        {leadSource && (
                            <div className="flex items-center gap-1.5 px-0 py-2 text-xs text-dr-text-muted">
                                <Icon name="info" size={12} />
                                <span className="min-w-0 flex-1 truncate">
                                    {t("pages.deals.info.fields.lead_source")}:{" "}
                                    {leadSource}
                                </span>
                            </div>
                        )}
                        {leadUrl && (
                            <div className="mt-2 border-t border-dr-border-soft pt-2 text-right">
                                <a
                                    href={leadUrl}
                                    className="text-xs font-semibold text-dr-blue no-underline"
                                >
                                    {t("pages.deals.dossier.view_lead_profile")}
                                </a>
                            </div>
                        )}
                    </>
                ),
            },
            {
                title: "Deal details",
                summary: packageSummary,
                body: (
                    <PackagePropertyManager
                        deal={deal}
                        restrictPackageOrProperty={restrictPackageOrProperty}
                    />
                ),
            },
            ...(showOnlinePayment
                ? [
                      {
                          title: "Payment",
                          summary: td("Payment request"),
                          body: (
                              <DealPaymentPanel
                                  deal={deal}
                                  canCreatePaymentRequest={canCreatePaymentRequest}
                                  canConfirmPaymentTransfer={canConfirmPaymentTransfer}
                              />
                          ),
                      },
                  ]
                : []),
            {
                title: "Documents",
                summary: `${documentSlots.filter((doc) => doc.uploaded).length}/${documentSlots.length}`,
                body: (
                    <div>
                        {documentSlots.length === 0 ? (
                            <p className="py-2 text-xs italic text-dr-text-hint">
                                {t("pages.deals.dossier.no_document_slots")}
                            </p>
                        ) : (
                            documentSlots.map((doc) => (
                                <DealDocumentSlotRow
                                    key={doc.id}
                                    doc={doc}
                                    onUpload={uploadToSlot}
                                    onDelete={deleteSlot}
                                    uploading={isUploadingField(doc.fieldName)}
                                    deleting={isDeletingField(doc.fieldName)}
                                    disabled={!canEdit}
                                />
                            ))
                        )}
                    </div>
                ),
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            canEdit,
            deal,
            documentSlots,
            email,
            emailCopied,
            // Drives the per-slot "Uploading…" state.
            isUploadingField,
            leadName,
            leadPhotoUrl,
            leadUrl,
            packageSummary,
            phone,
            clickToCallEnabled,
            initiateCall,
            isCalling,
            restrictPackageOrProperty,
            showOnlinePayment,
            canCreatePaymentRequest,
            canConfirmPaymentTransfer,
            td,
        ],
    );

    return (
        <aside aria-label={t("pages.deals.dossier.aria_label")}>
            <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-dr-text">
                    {t("pages.deals.dossier.title")}
                </h2>
                <button
                    type="button"
                    onClick={onSwitchToDealInfo}
                    className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-dr-blue"
                >
                    {t("pages.deals.dossier.open_deal_info")}
                </button>
            </div>
            {sections.map((section, index) => {
                const isOpen = open.has(section.title);
                return (
                    <div
                        key={section.title}
                        style={{
                            borderBottom:
                                index < sections.length - 1
                                    ? `1px solid ${T.BORDER_SOFT}`
                                    : "none",
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => toggle(section.title)}
                            aria-expanded={isOpen}
                            className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent py-3 text-left text-dr-text"
                        >
                            <span className="dr-label flex-1">
                                {t(
                                    `pages.deals.dossier.${SECTION_TITLE_KEYS[section.title]}`,
                                )}
                            </span>
                            {!isOpen && (
                                <span className="max-w-[140px] truncate text-xs font-medium text-dr-text-muted">
                                    {section.summary}
                                </span>
                            )}
                            <span className="flex text-dr-text-muted" aria-hidden="true">
                                <Icon
                                    name={isOpen ? "chevron-up" : "chevron-down"}
                                    size={14}
                                />
                            </span>
                        </button>
                        {isOpen && <div className="pb-2.5">{section.body}</div>}
                    </div>
                );
            })}
        </aside>
    );
}
