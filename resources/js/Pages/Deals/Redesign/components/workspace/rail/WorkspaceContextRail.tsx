import { ReactNode, useMemo, useState } from "react";
import { message } from "antd";
import type { Deal } from "@/Types/api/deals";
import type { DealFile } from "@/Types/api/file";
import useTranslation from "@/Hooks/useTranslation";
import { copyToClipboard, formatPhoneNumber } from "@/lib/utils";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { DealTab } from "../../../types";
import useDealDocuments from "../../../hooks/useDealDocuments";
import useDealDocumentUpload from "../../../hooks/useDealDocumentUpload";
import DealAvatar from "../../primitives/DealAvatar";
import DealIcon from "../../primitives/DealIcon";
import DealDocumentSlotRow from "../DealDocumentSlotRow";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";
import PackagePropertyManager from "./PackagePropertyManager";
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
    restrictPackageOrProperty?: boolean;
    onNavigateToSubTab: (tab: DealTab) => void;
    onSwitchToDealInfo: () => void;
    onManagePackagesProperties?: () => void;
}

const SECTION_TITLE_KEYS: Record<string, string> = {
    Lead: "section_lead",
    "Deal details": "section_deal_details",
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
    restrictPackageOrProperty = false,
    onNavigateToSubTab,
    onSwitchToDealInfo,
    onManagePackagesProperties,
}: WorkspaceContextRailProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState<Set<string>>(
        () => new Set(["Lead", "Deal details"]),
    );
    const [emailCopied, setEmailCopied] = useState(false);
    const documents = useDealDocuments(deal, files ?? [], fields, categoryIds);
    // Dossier only shows the three HIBARR-linked document slots — custom
    // file-type fields and loose attachments stay in the Files tab.
    const hibarrDocuments = useMemo(
        () => documents.documents.filter((doc) => doc.source === "hibarr"),
        [documents],
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
    const phone = formatPhoneNumber(contact?.mobile || contact?.cell || null);
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
                            <DealAvatar
                                size={34}
                                initials={initialsFromName(leadName)}
                                src={leadPhotoUrl}
                            />
                            <div>
                                <div className="text-sm font-semibold text-[#1a1f2e]">
                                    {leadName}
                                </div>
                                <div className="text-xs text-[#5b6472]">
                                    {t("pages.deals.dossier.lead_contact")}
                                </div>
                            </div>
                        </a>
                        {email && (
                            <button
                                type="button"
                                onClick={copyEmail}
                                className="flex w-full cursor-pointer items-center gap-1.5 rounded px-0 py-2 text-left text-xs text-[#5b6472] hover:bg-[#f5f6f8]"
                            >
                                <DealIcon name="mail" size={12} />
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
                            <a
                                href={`tel:${phone}`}
                                className="flex items-center gap-1.5 rounded px-0 py-2 text-xs text-[#5b6472] no-underline hover:bg-[#f5f6f8]"
                            >
                                <DealIcon name="phone" size={12} />
                                <span className="min-w-0 flex-1 truncate">{phone}</span>
                                <span
                                    className="ml-auto text-[12px] font-semibold"
                                    style={{ color: T.BLUE }}
                                >
                                    {t("pages.deals.dossier.call")}
                                </span>
                            </a>
                        )}
                        {leadSource && (
                            <div className="flex items-center gap-1.5 px-0 py-2 text-xs text-[#5b6472]">
                                <DealIcon name="info" size={12} />
                                <span className="min-w-0 flex-1 truncate">
                                    {t("pages.deals.info.fields.lead_source")}:{" "}
                                    {leadSource}
                                </span>
                            </div>
                        )}
                        {leadUrl && (
                            <div className="mt-2 border-t border-[#eef0f3] pt-2 text-right">
                                <a
                                    href={leadUrl}
                                    className="text-xs font-semibold text-[#1a6bb5] no-underline"
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
                    <>
                        <PackagePropertyManager
                            deal={deal}
                            restrictPackageOrProperty={restrictPackageOrProperty}
                        />
                        <div className="mt-1 border-t border-[#eef0f3] pt-2">
                            <button
                                type="button"
                                onClick={onManagePackagesProperties ?? onSwitchToDealInfo}
                                className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-[#1a6bb5]"
                            >
                                {t("pages.deals.dossier.open_deal_info")}
                            </button>
                        </div>
                    </>
                ),
            },
            {
                title: "Documents",
                summary: `${hibarrDocuments.filter((doc) => doc.uploaded).length}/${hibarrDocuments.length}`,
                body: (
                    <div>
                        {hibarrDocuments.length === 0 ? (
                            <p className="py-2 text-xs italic text-[#9ca3af]">
                                {t("pages.deals.dossier.no_document_slots")}
                            </p>
                        ) : (
                            hibarrDocuments.map((doc) => (
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
            hibarrDocuments,
            email,
            emailCopied,
            // Drives the per-slot "Uploading…" state.
            isUploadingField,
            leadName,
            leadUrl,
            packageSummary,
            phone,
            restrictPackageOrProperty,
        ],
    );

    return (
        <aside aria-label={t("pages.deals.dossier.aria_label")}>
            <h2 className="mb-1 text-sm font-bold text-[#1a1f2e]">
                {t("pages.deals.dossier.title")}
            </h2>
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
                            className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent py-3 text-left text-[#1a1f2e]"
                        >
                            <span className="dr-label flex-1">
                                {t(
                                    `pages.deals.dossier.${SECTION_TITLE_KEYS[section.title]}`,
                                )}
                            </span>
                            {!isOpen && (
                                <span className="max-w-[140px] truncate text-xs font-medium text-[#5b6472]">
                                    {section.summary}
                                </span>
                            )}
                            <span className="flex text-[#5b6472]" aria-hidden="true">
                                <DealIcon
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
