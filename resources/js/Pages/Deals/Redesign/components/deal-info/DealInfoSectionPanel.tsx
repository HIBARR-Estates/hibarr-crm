import { type ReactNode, useState } from "react";
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    EditOutlined,
    InfoCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { Button, Tag } from "antd";
import dayjs from "dayjs";
import CustomFieldDisplay from "@/Components/CustomFieldDisplay";
import { DetailField } from "@/Components/DetailSection";
import MultiUserIndicator from "@/Components/MultiUserIndicator";
import UserIndicator from "@/Components/UserIndicator";
import ManageDealPropertiesModal from "@/Features/Deals/Properties/AttachPropertiesModal";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Deal, HibarrDealFields } from "@/Types/api/deals";
import PropertyCarousel from "@/Pages/Deals/Components/PropertyCarousel";
import {
    DEAL_INFO_SECTION_META,
    getCategoriesForCoreSection,
    isCategorySectionId,
    parseCategorySectionId,
} from "../../config/dealInfoSections";
import type { DealInfoCoreSectionId, DealInfoSectionId } from "../../types";
import DealButton from "../primitives/DealButton";
import DealEditableField from "../primitives/DealEditableField";
import DealInfoGroupTitle from "./DealInfoGroupTitle";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";

interface DealInfoSectionPanelProps {
    sectionId: DealInfoSectionId;
    deal: Deal;
    fields: any[];
    customFieldCategories: Array<{ id: number; name: string }>;
    canEdit: boolean;
    isLocked: boolean;
    isFieldLoading: (fieldName: string) => boolean;
    updatingField: string | null;
    onFieldUpdate: (
        fieldName: string,
        value: unknown,
        type?: "details" | "contact" | "custom_field" | "hibarr_field",
    ) => Promise<void>;
    restrictPackageOrProperty?: boolean;
}

function FieldGrid({ children }: { children: ReactNode }) {
    return (
        <div className="mb-5 grid grid-cols-1 gap-1 gap-x-6 md:grid-cols-2">
            {children}
        </div>
    );
}

export default function DealInfoSectionPanel({
    sectionId,
    deal,
    fields,
    customFieldCategories,
    canEdit,
    isLocked,
    isFieldLoading,
    updatingField,
    onFieldUpdate,
    restrictPackageOrProperty = false,
}: DealInfoSectionPanelProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [propertyModalOpen, setPropertyModalOpen] = useState(false);
    const [refreshingProperties, setRefreshingProperties] = useState(false);
    const { t } = useTranslation();
    const { td } = useTd();
    const { setDeal } = useDealWorkspace();
    const hibarrFields: Partial<HibarrDealFields> = deal.hibarr_fields || {};
    const editing = isEditing && canEdit;

    const refreshDeal = async () => {
        setRefreshingProperties(true);
        try {
            const response = await axios.get(route("deals.refresh", deal.id));
            if (response.data?.status === "success" && response.data?.data) {
                setDeal(response.data.data);
            }
        } finally {
            setRefreshingProperties(false);
        }
    };

    const hasPackage = (deal.packages?.length ?? 0) > 0;
    const hasProperty = (deal.products?.length ?? 0) > 0;
    const totalAttached = (deal.packages?.length ?? 0) + (deal.products?.length ?? 0);
    const overPackagePropertyLimit = restrictPackageOrProperty && totalAttached > 1;
    const showPackagesField =
        !restrictPackageOrProperty || !hasProperty || overPackagePropertyLimit;
    const showPropertiesSection =
        !restrictPackageOrProperty || !hasPackage || overPackagePropertyLimit;

    const packagePropertyBanner = restrictPackageOrProperty && (
        <div
            className="mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed"
            style={{ color: "#92400e", background: "#fff7ed", borderColor: "#fed7aa" }}
        >
            <InfoCircleOutlined className="mt-0.5 shrink-0" />
            <span>
                {overPackagePropertyLimit
                    ? td(
                          "This deal has more packages/properties attached than the current CRM limit of one. Remove items to get back under the limit.",
                      )
                    : hasPackage
                      ? td(
                            "This is a package deal. To attach a property instead, remove the package first.",
                        )
                      : hasProperty
                        ? td(
                              "This is a property deal. To attach a package instead, remove the property first.",
                          )
                        : td(
                              "This CRM is configured to allow only one package or property per deal.",
                          )}
            </span>
        </div>
    );

    const categoryId = isCategorySectionId(sectionId)
        ? parseCategorySectionId(sectionId)
        : null;

    const sectionMeta = categoryId
        ? {
              title: td(
                  customFieldCategories.find(
                      (category) => category.id === categoryId,
                  )?.name || "Custom fields",
              ),
              subtitle: "Custom field category",
          }
        : DEAL_INFO_SECTION_META[sectionId as DealInfoCoreSectionId];

    const mappedCategories = !categoryId
        ? getCategoriesForCoreSection(
              sectionId as DealInfoCoreSectionId,
              customFieldCategories,
          )
        : [];

    const renderBoolean = (value: boolean | undefined) =>
        value ? (
            <Tag color="success" icon={<CheckCircleOutlined />}>
                Yes
            </Tag>
        ) : (
            <Tag color="default" icon={<CloseCircleOutlined />}>
                No
            </Tag>
        );

    const renderCustomFields = (
        categoryIds: number[],
        showGroupTitles = true,
    ) =>
        categoryIds.map((id) => {
            const category = customFieldCategories.find(
                (item) => item.id === id,
            );
            if (!category) return null;
            return (
                <div key={id} className="mb-4">
                    {showGroupTitles && mappedCategories.length > 1 ? (
                        <DealInfoGroupTitle>{td(category.name)}</DealInfoGroupTitle>
                    ) : null}
                    <CustomFieldDisplay
                        fields={fields}
                        customFieldsData={deal.custom_fields_data || {}}
                        categoryId={id}
                        column={2}
                        onUpdate={(field, value) =>
                            onFieldUpdate(field, value, "custom_field")
                        }
                        editable={editing}
                        loadingField={updatingField}
                        disabled={!canEdit}
                    />
                </div>
            );
        });

    const renderGeneral = () => (
        <>
            <DealInfoGroupTitle>
                {t("pages.deals.info.sections.overview")}
            </DealInfoGroupTitle>
            <FieldGrid>
                <DetailField label={t("pages.deals.info.fields.deal_name")}>
                    <DealEditableField
                        value={deal.name}
                        fieldName="name"
                        fieldType="text"
                        onSave={(value) => onFieldUpdate("name", value)}
                        alwaysEditing={editing}
                        loading={isFieldLoading("name")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label={t("pages.deals.info.fields.close_date")}>
                    <DealEditableField
                        value={deal.close_date}
                        fieldName="close_date"
                        fieldType="date"
                        onSave={(value) => onFieldUpdate("close_date", value)}
                        formatValue={(value) =>
                            value
                                ? dayjs(String(value)).format("MMM DD, YYYY")
                                : "--"
                        }
                        alwaysEditing={editing}
                        loading={isFieldLoading("close_date")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label={t("pages.deals.info.fields.deal_category")}>
                    <DealEditableField
                        value={deal.category_id}
                        fieldName="category_id"
                        selectorType="categories"
                        displayValue={
                            deal.category?.category_name ? (
                                <span className="text-gray-700">
                                    {deal.category.category_name}
                                </span>
                            ) : (
                                <span className="text-gray-400">--</span>
                            )
                        }
                        onSave={(value) => onFieldUpdate("category_id", value)}
                        alwaysEditing={editing}
                        loading={isFieldLoading("category_id")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label="Lead source">
                    {deal.contact?.lead_source?.type ? (
                        <span className="text-gray-700">
                            {deal.contact.lead_source.type}
                        </span>
                    ) : (
                        <span className="text-gray-400">--</span>
                    )}
                </DetailField>
            </FieldGrid>

            {packagePropertyBanner}
            <FieldGrid>
                {showPackagesField && (
                    <DetailField label={t("pages.deals.info.fields.packages")}>
                        <DealEditableField
                            value={deal.packages?.map((pkg) => pkg.id) || []}
                            fieldName="package_id"
                            selectorType="packages"
                            mode="multiple"
                            displayValue={
                                deal.packages?.length
                                    ? deal.packages
                                          .map((pkg) => pkg?.name || pkg)
                                          .join(", ")
                                    : "--"
                            }
                            onSave={(value) => onFieldUpdate("package_id", value)}
                            alwaysEditing={editing}
                            loading={isFieldLoading("package_id")}
                            disabled={!canEdit}
                        />
                    </DetailField>
                )}
                {showPropertiesSection && (
                    <DetailField
                        label={t("pages.deals.info.fields.properties")}
                        span={2}
                    >
                        <div className="w-full">
                            <Button
                                type="link"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => setPropertyModalOpen(true)}
                                loading={refreshingProperties}
                                className="!px-0 !text-xs"
                            >
                                {t("pages.deals.info.actions.manage_properties")}
                            </Button>
                            {deal.products && deal.products.length > 0 ? (
                                <PropertyCarousel products={deal.products} />
                            ) : (
                                <span className="text-sm text-gray-400">
                                    {t("pages.deals.info.no_properties")}
                                </span>
                            )}
                        </div>
                    </DetailField>
                )}
            </FieldGrid>

            <DealInfoGroupTitle>Interest & Budget</DealInfoGroupTitle>
            <FieldGrid>
                <DetailField label="Interested In">
                    <DealEditableField
                        value={hibarrFields.interested_in}
                        fieldName="interested_in"
                        fieldType="text"
                        onSave={(value) =>
                            onFieldUpdate("interested_in", value, "hibarr_field")
                        }
                        alwaysEditing={editing}
                        loading={isFieldLoading("interested_in")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label="Budget range">
                    <DealEditableField
                        value={hibarrFields.budget_range}
                        fieldName="budget_range"
                        fieldType="text"
                        onSave={(value) =>
                            onFieldUpdate("budget_range", value, "hibarr_field")
                        }
                        alwaysEditing={editing}
                        loading={isFieldLoading("budget_range")}
                        disabled={!canEdit}
                    />
                </DetailField>
            </FieldGrid>

            {mappedCategories.length > 0 &&
                renderCustomFields(
                    mappedCategories.map((category) => category.id),
                )}

            <ManageDealPropertiesModal
                open={propertyModalOpen}
                onClose={() => setPropertyModalOpen(false)}
                deal={deal}
                onRefresh={refreshDeal}
            />
        </>
    );

    const renderPrefTimeline = () => (
        <>
            <FieldGrid>
                <DetailField label="Purchase Timeline">
                    <DealEditableField
                        value={hibarrFields.purchase_timeline}
                        fieldName="purchase_timeline"
                        fieldType="text"
                        onSave={(value) =>
                            onFieldUpdate(
                                "purchase_timeline",
                                value,
                                "hibarr_field",
                            )
                        }
                        alwaysEditing={editing}
                        loading={isFieldLoading("purchase_timeline")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label="Strategy Meeting Booked">
                    <DealEditableField
                        value={hibarrFields.strategy_meeting_booked ? 1 : 0}
                        fieldName="strategy_meeting_booked"
                        fieldType="boolean"
                        displayValue={renderBoolean(
                            hibarrFields.strategy_meeting_booked,
                        )}
                        onSave={(value) =>
                            onFieldUpdate(
                                "strategy_meeting_booked",
                                value,
                                "hibarr_field",
                            )
                        }
                        alwaysEditing={editing}
                        loading={isFieldLoading("strategy_meeting_booked")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label="Motivation" span={2}>
                    <DealEditableField
                        value={hibarrFields.motivation}
                        fieldName="motivation"
                        fieldType="textarea"
                        onSave={(value) =>
                            onFieldUpdate("motivation", value, "hibarr_field")
                        }
                        alwaysEditing={editing}
                        loading={isFieldLoading("motivation")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label="Downpayment Paid">
                    <DealEditableField
                        value={hibarrFields.downpayment_paid ? 1 : 0}
                        fieldName="downpayment_paid"
                        fieldType="boolean"
                        displayValue={renderBoolean(hibarrFields.downpayment_paid)}
                        onSave={(value) =>
                            onFieldUpdate(
                                "downpayment_paid",
                                value,
                                "hibarr_field",
                            )
                        }
                        alwaysEditing={editing}
                        loading={isFieldLoading("downpayment_paid")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label="Inspection Trip Date">
                    <DealEditableField
                        value={hibarrFields.inspection_trip_date}
                        fieldName="inspection_trip_date"
                        fieldType="date"
                        onSave={(value) =>
                            onFieldUpdate(
                                "inspection_trip_date",
                                value,
                                "hibarr_field",
                            )
                        }
                        formatValue={(value) =>
                            value
                                ? dayjs(String(value)).format("MMM DD, YYYY")
                                : "--"
                        }
                        alwaysEditing={editing}
                        loading={isFieldLoading("inspection_trip_date")}
                        disabled={!canEdit}
                    />
                </DetailField>
            </FieldGrid>
            {mappedCategories.length > 0 &&
                renderCustomFields(
                    mappedCategories.map((category) => category.id),
                )}
        </>
    );

    const renderFunding = () => (
        <>
            <FieldGrid>
                <DetailField label="Deposit Confirmation">
                    <DealEditableField
                        value={hibarrFields.deposit_confirmation}
                        fieldName="deposit_confirmation"
                        fieldType="text"
                        onSave={(value) =>
                            onFieldUpdate(
                                "deposit_confirmation",
                                value,
                                "hibarr_field",
                            )
                        }
                        alwaysEditing={editing}
                        loading={isFieldLoading("deposit_confirmation")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label="Reservation Agreement">
                    <DealEditableField
                        value={hibarrFields.reservation_agreement}
                        fieldName="reservation_agreement"
                        fieldType="file"
                        onSave={(value) =>
                            onFieldUpdate(
                                "reservation_agreement",
                                value,
                                "hibarr_field",
                            )
                        }
                        alwaysEditing={editing}
                        loading={isFieldLoading("reservation_agreement")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label="Sales Contract">
                    <DealEditableField
                        value={hibarrFields.sales_contract}
                        fieldName="sales_contract"
                        fieldType="file"
                        onSave={(value) =>
                            onFieldUpdate("sales_contract", value, "hibarr_field")
                        }
                        alwaysEditing={editing}
                        loading={isFieldLoading("sales_contract")}
                        disabled={!canEdit}
                    />
                </DetailField>
            </FieldGrid>
            {mappedCategories.length > 0 &&
                renderCustomFields(
                    mappedCategories.map((category) => category.id),
                )}
        </>
    );

    const renderSupport = () => (
        <>
            <FieldGrid>
                <DetailField label="Message" span={2}>
                    <DealEditableField
                        value={hibarrFields.message}
                        fieldName="message"
                        fieldType="textarea"
                        onSave={(value) =>
                            onFieldUpdate("message", value, "hibarr_field")
                        }
                        alwaysEditing={editing}
                        loading={isFieldLoading("message")}
                        disabled={!canEdit}
                    />
                </DetailField>
            </FieldGrid>

            <DealInfoGroupTitle>
                {t("pages.deals.info.sections.team")}
            </DealInfoGroupTitle>
            <FieldGrid>
                <DetailField label={t("pages.deals.info.fields.deal_agent")}>
                    <DealEditableField
                        value={deal.agent_id}
                        fieldName="agent_id"
                        selectorType="lead-agents"
                        displayValue={
                            deal.lead_agent?.user ? (
                                <UserIndicator
                                    data={deal.lead_agent.user}
                                    size="sm"
                                    maxNameLength={40}
                                />
                            ) : (
                                <span className="text-gray-400">--</span>
                            )
                        }
                        onSave={(value) => onFieldUpdate("agent_id", value)}
                        alwaysEditing={editing}
                        loading={isFieldLoading("agent_id")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField
                    label={t("pages.deals.info.fields.deal_participants")}
                >
                    <DealEditableField
                        value={
                            deal.deal_participants?.map(
                                (participant) => participant.id,
                            ) || []
                        }
                        fieldName="deal_participant"
                        selectorType="employees"
                        mode="multiple"
                        displayValue={
                            deal.deal_participants &&
                            deal.deal_participants.length > 0 ? (
                                <MultiUserIndicator
                                    users={deal.deal_participants.map(
                                        (participant) => ({
                                            id: participant.id,
                                            image_url:
                                                participant.image_url ||
                                                participant.image,
                                            name: participant.name,
                                        }),
                                    )}
                                    size="sm"
                                />
                            ) : (
                                <span className="text-gray-400">--</span>
                            )
                        }
                        onSave={(value) =>
                            onFieldUpdate("deal_participant", value)
                        }
                        alwaysEditing={editing}
                        loading={isFieldLoading("deal_participant")}
                        disabled={!canEdit}
                    />
                </DetailField>
                <DetailField label={t("pages.deals.info.fields.deal_watchers")}>
                    <DealEditableField
                        value={
                            deal.deal_watchers?.map((watcher) => watcher.id) ||
                            []
                        }
                        fieldName="deal_watcher"
                        selectorType="employees"
                        mode="multiple"
                        displayValue={
                            deal.deal_watchers && deal.deal_watchers.length > 0 ? (
                                <MultiUserIndicator
                                    users={deal.deal_watchers.map((watcher) => ({
                                        id: watcher.id,
                                        image_url:
                                            watcher.image_url || watcher.image,
                                        name: watcher.name,
                                    }))}
                                    size="sm"
                                />
                            ) : (
                                <span className="text-gray-400">--</span>
                            )
                        }
                        onSave={(value) => onFieldUpdate("deal_watcher", value)}
                        alwaysEditing={editing}
                        loading={isFieldLoading("deal_watcher")}
                        disabled={!canEdit}
                    />
                </DetailField>
            </FieldGrid>

            {mappedCategories.length > 0 &&
                renderCustomFields(
                    mappedCategories.map((category) => category.id),
                )}
        </>
    );

    const renderMappedOnly = () =>
        mappedCategories.length > 0 ? (
            renderCustomFields(
                mappedCategories.map((category) => category.id),
                true,
            )
        ) : (
            <p className="text-xs text-[#8b95a7]">
                No fields are mapped to this section yet. Assign categories in{" "}
                <code className="text-[11px]">DEAL_INFO_CATEGORY_SECTION_MAP</code>{" "}
                or use a custom category tab in Later stages.
            </p>
        );

    const renderCategorySection = () => {
        if (!categoryId) return null;
        return (
            <CustomFieldDisplay
                fields={fields}
                customFieldsData={deal.custom_fields_data || {}}
                categoryId={categoryId}
                title={sectionMeta.title}
                column={2}
                onUpdate={(field, value) =>
                    onFieldUpdate(field, value, "custom_field")
                }
                editable={editing}
                loadingField={updatingField}
                disabled={!canEdit}
            />
        );
    };

    const renderSectionBody = () => {
        if (categoryId) return renderCategorySection();
        switch (sectionId as DealInfoCoreSectionId) {
            case "general":
                return renderGeneral();
            case "preftimeline":
                return renderPrefTimeline();
            case "funding":
                return renderFunding();
            case "support":
                return renderSupport();
            default:
                return renderMappedOnly();
        }
    };

    return (
        <section className="pl-[26px] pt-1">
            <div className="mb-3.5 flex items-start justify-between gap-3">
                <div>
                    <h3 className="mb-0.5 text-base font-medium text-[#0f172a]">
                        {sectionMeta.title}
                    </h3>
                    <p className="text-xs text-[#5b6472]">{sectionMeta.subtitle}</p>
                </div>
                {canEdit && (
                    <DealButton
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditing((previous) => !previous)}
                    >
                        {isEditing ? "Done editing" : "Edit fields"}
                    </DealButton>
                )}
            </div>
            {renderSectionBody()}
        </section>
    );
}
