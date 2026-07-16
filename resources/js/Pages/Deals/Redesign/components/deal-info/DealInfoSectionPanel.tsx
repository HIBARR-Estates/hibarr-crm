import { type ReactNode, useMemo, useState } from "react";
import {
    CalendarOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    EditOutlined,
    GiftOutlined,
    InfoCircleOutlined,
    LinkOutlined,
    MailOutlined,
    PhoneOutlined,
    ReloadOutlined,
} from "@ant-design/icons";
import { Link, router, usePage } from "@inertiajs/react";
import { Button, Tag, Tooltip } from "antd";
import dayjs from "dayjs";
import CustomFieldDisplay from "@/Components/CustomFieldDisplay";
import { DetailField } from "@/Components/DetailSection";
import MultiUserIndicator from "@/Components/MultiUserIndicator";
import UserIndicator from "@/Components/UserIndicator";
import ManageDealPropertiesModal from "@/Features/Deals/Properties/AttachPropertiesModal";
import { getDealValueInsight } from "@/Features/Deals/utils/valueInsights";
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

interface DealInfoSectionPanelProps {
    sectionId: DealInfoSectionId;
    deal: Deal;
    fields: any[];
    customFieldCategories: Array<{ id: number; name: string }>;
    canEdit: boolean;
    isLocked: boolean;
    isFieldLoading: (fieldName: string) => boolean;
    updatingField: string | null;
    isRecalculatingValue: boolean;
    onFieldUpdate: (
        fieldName: string,
        value: unknown,
        type?: "details" | "contact" | "custom_field" | "hibarr_field",
    ) => Promise<void>;
    onRecalculateValue: () => Promise<void>;
    restrictPackageOrProperty?: boolean;
}

function getMobileNumber(mobile: string | null | undefined) {
    if (!mobile) return "--";
    if (typeof mobile === "string" && mobile.trim().startsWith("{")) {
        try {
            const mobileData = JSON.parse(mobile.trim());
            return mobileData?.phone || mobile;
        } catch {
            return mobile;
        }
    }
    return mobile;
}

function formatCurrency(value: number, currencySymbol = "£") {
    if (!value) return "--";
    return `${currencySymbol}${value.toLocaleString()}`;
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
    isRecalculatingValue,
    onFieldUpdate,
    onRecalculateValue,
    restrictPackageOrProperty = false,
}: DealInfoSectionPanelProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [propertyModalOpen, setPropertyModalOpen] = useState(false);
    const { props } = usePage<any>();
    const { t } = useTranslation();
    const { td } = useTd();
    const defaultCurrencyCode = props.default_currency_code || "TRY";
    const hibarrFields: Partial<HibarrDealFields> = deal.hibarr_fields || {};
    const valueInsight = useMemo(() => getDealValueInsight(deal), [deal]);
    const currentCurrencySymbol = deal.currency?.currency_symbol || "£";
    const editing = isEditing && canEdit;

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
                <DetailField label={t("pages.deals.info.fields.deal_value")}>
                    <div className="flex flex-col items-start gap-2 md:flex-row md:items-center">
                        <DealEditableField
                            value={{
                                amount: deal.value ?? null,
                                currency:
                                    deal.currency?.currency_code ||
                                    defaultCurrencyCode,
                            }}
                            fieldName="value"
                            fieldType="currency"
                            onSave={(value) => onFieldUpdate("value", value)}
                            alwaysEditing={editing}
                            loading={isFieldLoading("value")}
                            disabled={!canEdit || isLocked}
                        />
                        {!editing && (
                            <>
                                <Tooltip
                                    placement="topLeft"
                                    title={
                                        <div style={{ minWidth: 220 }}>
                                            <div>
                                                {t(
                                                    "pages.deals.info.value_insight.properties",
                                                )}
                                                :{" "}
                                                {valueInsight.productsTotal !==
                                                null
                                                    ? formatCurrency(
                                                          valueInsight.productsTotal,
                                                          currentCurrencySymbol,
                                                      )
                                                    : "--"}
                                            </div>
                                            <div>
                                                {t(
                                                    "pages.deals.info.value_insight.packages",
                                                )}
                                                :{" "}
                                                {formatCurrency(
                                                    valueInsight.packagesTotal,
                                                    currentCurrencySymbol,
                                                )}
                                            </div>
                                            <div>
                                                {t(
                                                    "pages.deals.info.value_insight.total",
                                                )}
                                                :{" "}
                                                {formatCurrency(
                                                    valueInsight.finalValue,
                                                    currentCurrencySymbol,
                                                )}
                                            </div>
                                        </div>
                                    }
                                >
                                    <InfoCircleOutlined className="cursor-help text-blue-500" />
                                </Tooltip>
                                <Tooltip
                                    title={t(
                                        "pages.deals.info.actions.recalculate_value_tooltip",
                                    )}
                                >
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={
                                            <ReloadOutlined
                                                spin={isRecalculatingValue}
                                            />
                                        }
                                        onClick={onRecalculateValue}
                                        disabled={
                                            !canEdit ||
                                            isLocked ||
                                            isRecalculatingValue
                                        }
                                    />
                                </Tooltip>
                            </>
                        )}
                        {!editing &&
                            deal.total_discount != null &&
                            deal.total_discount > 0 && (
                                <Tag color="green" icon={<GiftOutlined />}>
                                    -
                                    {formatCurrency(
                                        Number(deal.total_discount),
                                        currentCurrencySymbol,
                                    )}
                                </Tag>
                            )}
                    </div>
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
                <DetailField label={t("pages.deals.info.fields.lead_contact")}>
                    <DealEditableField
                        value={deal.lead_id}
                        fieldName="lead_id"
                        selectorType="leads"
                        displayValue={
                            deal.contact ? (
                                <div className="flex min-w-0 flex-col gap-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium text-gray-900">
                                            {deal.contact.client_name_salutation ||
                                                deal.contact.client_name}
                                        </span>
                                        {deal.contact.client_id && (
                                            <Tag color="blue" className="text-xs">
                                                {t("pages.deals.info.client_tag")}
                                            </Tag>
                                        )}
                                    </div>
                                    <Link
                                        href={route(
                                            "lead-contact.show",
                                            deal.contact.id,
                                        )}
                                        className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800"
                                    >
                                        <LinkOutlined />
                                        {t(
                                            "pages.deals.info.actions.view_lead_profile",
                                        )}
                                    </Link>
                                </div>
                            ) : (
                                <span className="text-gray-400">--</span>
                            )
                        }
                        onSave={(value) => onFieldUpdate("lead_id", value)}
                        alwaysEditing={editing}
                        loading={isFieldLoading("lead_id")}
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
                <DetailField label={t("pages.deals.info.fields.created_at")}>
                    {deal.created_at ? (
                        <span className="flex items-center gap-1">
                            <CalendarOutlined className="text-gray-400" />
                            {dayjs(deal.created_at).format("MMM DD, YYYY HH:mm")}
                        </span>
                    ) : (
                        <span className="text-gray-400">--</span>
                    )}
                </DetailField>
                <DetailField label={t("pages.deals.info.fields.updated_at")}>
                    {deal.updated_at ? (
                        <span className="flex items-center gap-1">
                            <CalendarOutlined className="text-gray-400" />
                            {dayjs(deal.updated_at).format("MMM DD, YYYY HH:mm")}
                        </span>
                    ) : (
                        <span className="text-gray-400">--</span>
                    )}
                </DetailField>
                {deal.lead_status && (
                    <DetailField label={t("pages.deals.info.fields.status")}>
                        <Tag
                            color={deal.lead_status.label_color}
                            className="font-medium"
                        >
                            {deal.lead_status.type}
                        </Tag>
                    </DetailField>
                )}
            </FieldGrid>

            <DealInfoGroupTitle>
                {t("pages.deals.info.sections.contact_info")}
            </DealInfoGroupTitle>
            <FieldGrid>
                <DetailField
                    label={t("pages.deals.info.fields.email")}
                    copyValue={deal.contact?.client_email || undefined}
                >
                    <div className="flex w-full items-center gap-x-2">
                        {deal.contact?.client_email && (
                            <MailOutlined className="flex-shrink-0 text-gray-400" />
                        )}
                        {deal.contact?.client_email ? (
                            <DealEditableField
                                value={deal.contact.client_email}
                                fieldName="email"
                                fieldType="email"
                                onSave={(value) => onFieldUpdate("email", value)}
                                alwaysEditing={editing}
                                loading={isFieldLoading("email")}
                                disabled={!canEdit}
                            />
                        ) : (
                            <span className="text-gray-400">--</span>
                        )}
                    </div>
                </DetailField>
                <DetailField
                    label={t("pages.deals.info.fields.mobile")}
                    copyValue={getMobileNumber(deal.contact?.mobile) || undefined}
                >
                    {deal.contact ? (
                        <div className="flex items-center gap-x-2">
                            <PhoneOutlined className="flex-shrink-0 text-gray-400" />
                            <DealEditableField
                                value={getMobileNumber(deal.contact.mobile)}
                                fieldName="mobile"
                                fieldType="phone"
                                onSave={(value) => onFieldUpdate("mobile", value)}
                                alwaysEditing={editing}
                                loading={isFieldLoading("mobile")}
                                disabled={!canEdit}
                            />
                        </div>
                    ) : (
                        <span className="text-gray-400">--</span>
                    )}
                </DetailField>
                <DetailField
                    label={t("pages.deals.info.fields.company_name")}
                    span={2}
                >
                    <DealEditableField
                        value={deal.contact?.company_name}
                        fieldName="company_name"
                        fieldType="text"
                        onSave={(value) => onFieldUpdate("company_name", value)}
                        alwaysEditing={editing}
                        loading={isFieldLoading("company_name")}
                        disabled={!canEdit}
                    />
                </DetailField>
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
        </>
    );

    const renderProperty = () => (
        <>
            {packagePropertyBanner}
            {showPropertiesSection && (
                <FieldGrid>
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
                </FieldGrid>
            )}
            {mappedCategories.length > 0 &&
                renderCustomFields(
                    mappedCategories.map((category) => category.id),
                )}
            <ManageDealPropertiesModal
                open={propertyModalOpen}
                onClose={() => setPropertyModalOpen(false)}
                deal={deal}
                onRefresh={() => router.reload({ only: ["deal"] })}
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
            case "property":
                return renderProperty();
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
                        style={{ fontSize: 11, padding: "5px 10px" }}
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
