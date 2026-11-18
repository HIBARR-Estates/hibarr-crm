import React, { useEffect, useMemo, useRef } from "react";
import {
    Form,
    Input,
    InputNumber,
    Select,
    Row,
    Col,
    Checkbox,
    Divider,
    Button,
    DatePicker,
} from "antd";
import { Lead } from "@/Types/api/leads";
import { usePage } from "@inertiajs/react";
import { useCountries } from "@/Hooks/useFormData";
import { LeadFormProps } from "./LeadForm";
import LeadDealCreation from "./LeadDealCreation";
import dayjs from "dayjs";
import { companyDateDayjsFormat } from "@/lib/companyDateTime";
import FormDataSelector from "@/Components/FormDataSelector";
import PhoneInput from "antd-phone-input";
import {
    computeAgeFieldsFromDateOfBirth,
    computeAgeRangeFromAge,
    getLeadAgeFieldVisibility,
} from "@/lib/leadAge";
import { useTranslation } from "@/Hooks/useTranslation";

// interface BasicInfoTabProps
//     extends Pick
//         LeadFormProps,
//         | "onCancel"
//         | "loading"
//         | "submitText"
//         | "cancelText"
//         | "data"
//         | "onSubmit"
//         | "setErrors"
//         | "onErrorsClear"
//     > {
//     setLead?: (lead: Lead | undefined) => void;
//     onUserEdit?: () => void;
//     formId?: string;
//     hideFooter?: boolean;
//     languageOptions?: Array<{ value: string; label: string }>;
//     languagesLoading?: boolean;
// }

interface BasicInfoTabProps extends Pick<
    LeadFormProps,
    | "onCancel"
    | "loading"
    | "submitText"
    | "cancelText"
    | "data"
    | "onSubmit"
    | "setErrors"
    | "onErrorsClear"
> {
    setLead?: (lead: Lead | undefined) => void;
    onUserEdit?: () => void;
    formId?: string;
    hideFooter?: boolean;
    languageOptions?: Array<{ value: string; label: string }>;
    languagesLoading?: boolean;
}

const BasicInfoTab: React.FC<BasicInfoTabProps> = ({
    data,
    onSubmit,
    onCancel,
    loading = false,
    submitText,
    cancelText,
    onErrorsClear,
    setErrors,
    setLead,
    onUserEdit,
    formId,
    hideFooter = false,
    languageOptions = [],
    languagesLoading = false,
}) => {
    const { t } = useTranslation();
    const { props } = usePage<any>();
    const { countries } = useCountries();
    const {
        salutations,
        sources,
        categories,
        employees,
        permissions,
        leadLifecycleStatuses,
    } = props;
    const lifecycleStatusOptions = useMemo(
        () =>
            (
                (leadLifecycleStatuses as Array<{
                    id: number;
                    label: string;
                }>) || []
            ).map((status) => ({
                value: status.id,
                label: status.label,
            })),
        [leadLifecycleStatuses],
    );
    const [form] = Form.useForm();
    const isPopulatingRef = useRef(false);
    const defaultCurrencySymbol = props.default_currency_symbol || "£";
    const isEditing = data ? true : false;

    // Populate form when data changes
    useEffect(() => {
        if (data) {
            isPopulatingRef.current = true;
            const computedAgeFields = data.date_of_birth
                ? computeAgeFieldsFromDateOfBirth(data.date_of_birth)
                : {
                      age: data.age ?? null,
                      age_range: data.age_range ?? null,
                  };
            const formData = {
                ...data,
                close_date: data.close_date ? dayjs(data.close_date) : null,
                date_of_birth: data.date_of_birth
                    ? dayjs(data.date_of_birth)
                    : null,
                age: computedAgeFields.age ?? data.age ?? null,
                age_range:
                    computedAgeFields.age_range ?? data.age_range ?? null,
                deal_watcher: data.deal_watcher || [],
                product_id: data.product_id || [],
            };
            form.setFieldsValue(formData);
            queueMicrotask(() => {
                isPopulatingRef.current = false;
            });
        }
    }, [data, form]);

    // watch create_deal and create_client checkboxes to update form values
    const createDeal = Form.useWatch("create_deal", form);
    const createClient = Form.useWatch("create_client", form);
    const dateOfBirth = Form.useWatch("date_of_birth", form);
    const watchedAge = Form.useWatch("age", form);
    const watchedAgeRange = Form.useWatch("age_range", form);

    const ageFieldVisibility = useMemo(
        () =>
            getLeadAgeFieldVisibility({
                dateOfBirth:
                    dateOfBirth === undefined
                        ? (data?.date_of_birth ?? null)
                        : dateOfBirth
                          ? dateOfBirth.format("YYYY-MM-DD")
                          : null,
                age: watchedAge ?? data?.age ?? null,
                ageRange: watchedAgeRange ?? data?.age_range ?? null,
            }),
        [dateOfBirth, watchedAge, watchedAgeRange, data],
    );

    useEffect(() => {
        if (isPopulatingRef.current) {
            return;
        }

        if (dateOfBirth) {
            const { age, age_range } =
                computeAgeFieldsFromDateOfBirth(dateOfBirth);
            form.setFieldsValue({ age, age_range });
            return;
        }

        if (watchedAge != null) {
            form.setFieldsValue({
                age_range: computeAgeRangeFromAge(Number(watchedAge)),
            });
        }
    }, [dateOfBirth, watchedAge, form]);

    const handleSubmit = (values: any) => {
        const computedAgeFields = values.date_of_birth
            ? computeAgeFieldsFromDateOfBirth(values.date_of_birth)
            : {
                  age:
                      values.age === null || values.age === undefined
                          ? null
                          : Number(values.age),
                  age_range: values.age_range || null,
              };

        // Transform the values to match the API expectations
        const formData = {
            ...values,
            close_date:
                values.close_date && values.close_date.isValid?.()
                    ? values.close_date.format("YYYY-MM-DD")
                    : null,
            date_of_birth: values.date_of_birth
                ? values.date_of_birth.format("YYYY-MM-DD")
                : null,
            age: computedAgeFields.age,
            age_range: computedAgeFields.age_range,
            deal_watcher: values.deal_watcher || [],
            product_id: values.product_id || [],
            strategy_accepted: values.strategy_accepted || false,
            downpayment_confirmed: values.downpayment_confirmed || false,
            create_deal: createDeal,
        };

        onSubmit(formData);
    };

    return (
        <Form
            id={formId}
            form={form}
            initialValues={data || undefined}
            layout="vertical"
            onFinish={handleSubmit}
            onValuesChange={() => {
                if (!isPopulatingRef.current) {
                    onUserEdit?.();
                }
            }}
            onFinishFailed={(errorInfo) => {
                setErrors?.(
                    errorInfo.errorFields.map((field) => field.errors).flat(),
                );
                if (onErrorsClear) {
                    onErrorsClear();
                }
            }}
            size="middle"
        >
            <div className="space-y-1">
                <section className="save-lead-form__section">
                    <h3 className="save-lead-form__section-title">
                        {t("pages.leads.save_form.section_contact")}
                    </h3>
                    <Row gutter={[24, 16]}>
                        <Col xs={24} md={8}>
                            <Form.Item label={t("pages.leads.save_form.salutation")} name="salutation">
                                <FormDataSelector
                                    type="salutations"
                                    placeholder="—"
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                            <Form.Item label={t("pages.leads.save_form.gender")} name="gender">
                                <FormDataSelector
                                    type="genders"
                                    placeholder="—"
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                            <Form.Item
                                label={t("pages.leads.save_form.name")}
                                name="client_name"
                                required
                                rules={[
                                    {
                                        required: true,
                                        message: t("pages.leads.save_form.name_required"),
                                    },
                                ]}
                            >
                                <Input placeholder={t("pages.leads.save_form.enter_full_name")} />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                            <Form.Item label={t("pages.leads.save_form.email")} name="client_email">
                                <Input
                                    type="email"
                                    placeholder={t("pages.leads.save_form.enter_email")}
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                            <Form.Item label={t("pages.leads.save_form.mobile")} name="mobile">
                                <PhoneInput
                                    id="mobile"
                                    enableSearch
                                    placeholder="—"
                                    country=""
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                            <Form.Item
                                label={t("pages.leads.save_form.preferred_contact_time")}
                                name="preferred_contact_times"
                            >
                                <FormDataSelector
                                    type="preferred-contact-times"
                                    mode="multiple"
                                    placeholder="—"
                                />
                            </Form.Item>
                        </Col>

                        {permissions?.view_lead_sources !== "none" && (
                            <Col xs={24} md={8}>
                                <Form.Item label={t("pages.leads.save_form.lead_source")} name="source_id">
                                    <FormDataSelector
                                        type="sources"
                                        placeholder={t("pages.leads.save_form.lead_source")}
                                    />
                                </Form.Item>
                            </Col>
                        )}

                        {permissions?.view_lead_categories !== "none" && (
                            <Col xs={24} md={8}>
                                <Form.Item
                                    label={t("pages.leads.save_form.lead_category")}
                                    name="category_ids"
                                >
                                    <FormDataSelector
                                        type="categories"
                                        mode="multiple"
                                        placeholder={t("pages.leads.save_form.lead_categories")}
                                    />
                                </Form.Item>
                            </Col>
                        )}
                        
                        <Col xs={24} md={8}>
                            <Form.Item label={t("pages.leads.save_form.temperature")} name="temperature">
                                <FormDataSelector
                                    type="temperatures"
                                    placeholder="—"
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                            <Form.Item
                                label={t("pages.leads.save_form.lifecycle_status")}
                                name="lead_lifecycle_status_id"
                            >
                                <Select
                                    allowClear
                                    placeholder={t("pages.leads.save_form.lifecycle_status")}
                                    options={lifecycleStatusOptions}
                                />
                            </Form.Item>
                        </Col>

                        {permissions?.add_lead === "all" && (
                            <Col xs={24} md={8}>
                                <Form.Item label={t("pages.leads.save_form.added_by")} name="added_by">
                                    <FormDataSelector
                                        type="employees"
                                        placeholder={t("pages.leads.save_form.added_by")}
                                    />
                                </Form.Item>
                            </Col>
                        )}

                        <Col xs={24} md={8}>
                            <Form.Item label={t("pages.leads.save_form.lead_owner")} name="lead_owner">
                                <FormDataSelector
                                    type="employees"
                                    placeholder={t("pages.leads.save_form.lead_owner")}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {isEditing && (
                        <>
                            {["all", "added"].includes(
                                permissions?.add_deals,
                            ) && (
                                <Row gutter={[24, 16]} className="mt-2">
                                    <Col span={24}>
                                        <Form.Item name="create_deal">
                                            <Checkbox>{t("pages.leads.save_form.create_deal")}</Checkbox>
                                        </Form.Item>
                                    </Col>
                                </Row>
                            )}

                            <div className="save-lead-form__auto-convert">
                                <Form.Item name="create_client">
                                    <Checkbox>
                                        {t("pages.leads.save_form.auto_convert_prefix")}{" "}
                                        <strong>{t("pages.leads.save_form.won")}</strong>
                                    </Checkbox>
                                </Form.Item>
                            </div>
                        </>
                    )}

                    {createDeal && <LeadDealCreation />}
                </section>

                <section className="save-lead-form__section">
                        <h3 className="save-lead-form__section-title">
                            {t("pages.leads.save_form.section_personal")}
                        </h3>
                        <Row gutter={[24, 16]}>
                            <Col span={12}>
                                <Form.Item label={t("pages.leads.save_form.languages")} name="languages">
                                    <Select
                                        mode="multiple"
                                        allowClear
                                        placeholder={t("pages.leads.save_form.select_languages")}
                                        options={languageOptions}
                                        loading={languagesLoading}
                                        showSearch
                                        optionFilterProp="label"
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)] gap-3 w-full">
                                    <Form.Item
                                        label={t("pages.leads.save_form.date_of_birth")}
                                        name="date_of_birth"
                                    >
                                        <DatePicker
                                            className="w-full"
                                            format={companyDateDayjsFormat()}
                                            placeholder={t("pages.leads.save_form.select_date")}
                                        />
                                    </Form.Item>
                                    <Form.Item label={t("pages.leads.save_form.age")} name="age">
                                        <InputNumber
                                            className="!w-full"
                                            min={0}
                                            max={300}
                                            placeholder={t("pages.leads.save_form.enter_age")}
                                            disabled={
                                                ageFieldVisibility.ageAndRangeReadOnly
                                            }
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        label={t("pages.leads.save_form.age_range")}
                                        name="age_range"
                                    >
                                        <FormDataSelector
                                            type="age-ranges"
                                            placeholder={t("pages.leads.save_form.select_age_range")}
                                            disabled={
                                                ageFieldVisibility.ageAndRangeReadOnly
                                            }
                                        />
                                    </Form.Item>
                                </div>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    label={t("pages.leads.save_form.nationality")}
                                    name="nationality"
                                >
                                    <Select
                                        placeholder={t("pages.leads.save_form.select_nationality")}
                                        allowClear
                                        showSearch
                                        optionFilterProp="label"
                                    >
                                        {(countries || []).map(
                                            (country: {
                                                iso: string;
                                                nicename: string;
                                            }) => (
                                                <Select.Option
                                                    key={country.iso}
                                                    value={country.nicename}
                                                    label={country.nicename}
                                                >
                                                    {country.nicename}
                                                </Select.Option>
                                            ),
                                        )}
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item label={t("pages.leads.save_form.occupation")} name="occupation">
                                    <Input placeholder={t("pages.leads.save_form.enter_occupation")} />
                                </Form.Item>
                            </Col>
                        </Row>
                </section>

                <section className="save-lead-form__section">
                    <h3 className="save-lead-form__section-title">
                        {t("pages.leads.save_form.section_address")}
                    </h3>
                    <Row gutter={[24, 16]}>
                        <Col span={24}>
                            <Form.Item label={t("pages.leads.save_form.street_address")} name="address">
                                <Input placeholder={t("pages.leads.save_form.enter_street_address")} />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item label={t("pages.leads.save_form.postcode")} name="postal_code">
                                <Input placeholder={t("pages.leads.save_form.enter_postcode")} />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item label={t("pages.leads.save_form.city")} name="city">
                                <Input placeholder={t("pages.leads.save_form.enter_city")} />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item label={t("pages.leads.save_form.state_province")} name="state">
                                <Input placeholder={t("pages.leads.save_form.enter_state_province")} />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item label={t("pages.leads.save_form.country")} name="country">
                                <Select
                                    placeholder={t("pages.leads.save_form.select_country_dashes")}
                                    allowClear
                                    showSearch
                                    optionFilterProp="label"
                                    filterOption={(input, option) => {
                                        const searchText = input.toLowerCase();
                                        const countryValue =
                                            option?.value as string;
                                        const country = (countries || []).find(
                                            (c: {
                                                iso: string;
                                                nicename: string;
                                                name?: string;
                                                iso3?: string;
                                                nationality?: string;
                                            }) => c.nicename === countryValue,
                                        );

                                        if (!country) return false;

                                        return (
                                            country.nicename
                                                ?.toLowerCase()
                                                .includes(searchText) ||
                                            country.name
                                                ?.toLowerCase()
                                                .includes(searchText) ||
                                            country.iso
                                                ?.toLowerCase()
                                                .includes(searchText) ||
                                            country.iso3
                                                ?.toLowerCase()
                                                .includes(searchText) ||
                                            country.nationality
                                                ?.toLowerCase()
                                                .includes(searchText)
                                        );
                                    }}
                                >
                                    {(countries || []).map(
                                        (country: {
                                            iso: string;
                                            nicename: string;
                                        }) => (
                                            <Select.Option
                                                key={country.iso}
                                                value={country.nicename}
                                                label={country.nicename}
                                            >
                                                <span
                                                    className={`flag-icon flag-icon-${country.iso.toLowerCase()} mr-2`}
                                                />
                                                {country.nicename}
                                            </Select.Option>
                                        ),
                                    )}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                </section>

                {!hideFooter && (
                    <>
                        <Divider />
                        <Row justify="end" gutter={8} style={{ marginTop: 24 }}>
                            <Col>
                                <Button onClick={onCancel}>{cancelText ?? t("pages.leads.save_form.cancel")}</Button>
                            </Col>
                            <Col>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    loading={loading}
                                >
                                    {submitText ?? t("pages.leads.save_form.save_contact")}
                                </Button>
                            </Col>
                        </Row>
                    </>
                )}
            </div>
        </Form>
    );
};

export default BasicInfoTab;
