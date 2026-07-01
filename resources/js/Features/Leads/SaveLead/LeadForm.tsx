import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
    useMemo,
} from "react";
import { Tabs, Alert, Button } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";
import { CreateLeadFormData, Lead } from "@/Types/api/leads";
import { usePage } from "@inertiajs/react";
import { useFormData } from "@/Hooks/useFormData";
import { Language } from "@/Types";
import BasicInfoTab from "./BasicInfoTab";
import CustomFieldTab from "./CustomFieldTab";
export const SAVE_LEAD_BASIC_FORM_ID = "save-lead-basic-form";

export const getSaveLeadCustomFormId = (categoryId: number) =>
    `save-lead-custom-form-${categoryId}`;

export interface LeadFormProps {
    data?: CreateLeadFormData;
    setLead?: (lead: Lead | undefined) => void;
    onSubmit: (values: any) => void;
    onCancel: () => void;
    loading?: boolean;
    errors?: string[];
    setErrors?: (errors: string[]) => void;
    onErrorsClear?: () => void;
    submitText?: string;
    cancelText?: string;
    visible?: boolean;
    isEditing?: boolean;
    getIsDirtyRef?: React.MutableRefObject<(() => boolean) | null>;
}

const LeadForm: React.FC<LeadFormProps> = ({
    data,
    onSubmit,
    onCancel: _onCancel,
    loading = false,
    setLead,
    errors = [],
    setErrors,
    onErrorsClear,
    visible,
    isEditing = false,
    getIsDirtyRef,
}) => {
    const [activeTab, setActiveTab] = useState("basic");
    const userEditedRef = useRef(false);
    const { props } = usePage<any>();
    const customFieldCategories =
        props.leadCustomFieldCategories || props.customFieldCategories || [];

    const pageLanguages = useMemo(
        () =>
            (props.languages as Array<{
                language_code: string;
                language_name: string;
            }>) || [],
        [props.languages],
    );

    const { data: fetchedLanguages, loading: languagesLoading } =
        useFormData<Language>("languages", {
            enabled: pageLanguages.length === 0,
        });

    const languageOptions = useMemo(() => {
        const source =
            pageLanguages.length > 0 ? pageLanguages : fetchedLanguages;

        return (source || []).map(
            (lang: { language_code: string; language_name: string }) => ({
                value: lang.language_code,
                label: lang.language_name,
            }),
        );
    }, [pageLanguages, fetchedLanguages]);
    
    const markUserEdited = useCallback(() => {
        userEditedRef.current = true;
    }, []);

    useEffect(() => {
        if (getIsDirtyRef) {
            getIsDirtyRef.current = () => userEditedRef.current;
        }
    }, [getIsDirtyRef]);

    useEffect(() => {
        if (visible) {
            userEditedRef.current = false;
        } else {
            setActiveTab("basic");
        }
    }, [visible]);

    const onCancel = () => {
        setActiveTab("basic");
        setErrors?.([]);
        setLead?.(undefined);
        _onCancel?.();
    };

    const activeFormId = useMemo(() => {
        if (activeTab === "basic") {
            return SAVE_LEAD_BASIC_FORM_ID;
        }

        const categoryId = Number(activeTab.replace("custom_", ""));
        if (!Number.isNaN(categoryId)) {
            return getSaveLeadCustomFormId(categoryId);
        }

        return SAVE_LEAD_BASIC_FORM_ID;
    }, [activeTab]);

    const submitLabel = isEditing ? "Update lead" : "Save lead";

    const tabItems = [
        {
            key: "basic",
            label: "Contact Details",
            children: (
                <BasicInfoTab
                    data={data}
                    onSubmit={onSubmit}
                    onCancel={onCancel}
                    loading={loading}
                    onErrorsClear={onErrorsClear}
                    setErrors={setErrors}
                    onUserEdit={markUserEdited}
                    formId={SAVE_LEAD_BASIC_FORM_ID}
                    hideFooter
                    languageOptions={languageOptions}
                    languagesLoading={languagesLoading}
                />
            ),
        },

        ...customFieldCategories.map((category: any) => ({
            key: `custom_${category.id}`,
            label: category.name,
            children: data ? (
                <CustomFieldTab
                    data={data}
                    onSubmit={onSubmit}
                    onCancel={onCancel}
                    loading={loading}
                    categoryId={category.id}
                    categoryName={category.name}
                    onUserEdit={markUserEdited}
                    formId={getSaveLeadCustomFormId(category.id)}
                    hideFooter
                />
            ) : null,
            disabled: !isEditing,
        })),
    ];

    return (
        <div className="save-lead-form">
            {errors.length > 0 && (
                <div className="save-lead-form__errors">
                    <Alert
                        message="Validation Error"
                        description={
                            <ul className="mb-0">
                                {errors.map((error, index) => (
                                    <li key={index}>{error}</li>
                                ))}
                            </ul>
                        }
                        type="error"
                        showIcon
                        closable
                        onClose={onErrorsClear}
                    />
                </div>
            )}

            <Tabs
                className="save-lead-form__tabs"
                activeKey={activeTab}
                onChange={setActiveTab}
                items={tabItems}
            />

            <div className="save-lead-form__footer">
                <Button
                    type="text"
                    className="save-lead-form__cancel-btn"
                    onClick={onCancel}
                    disabled={loading}
                >
                    Cancel
                </Button>

                <div className="save-lead-form__footer-actions">
                    {/* {!isEditing && (
                        <Button className="save-lead-form__draft-btn" disabled>
                            Save as draft
                        </Button>
                    )} */}
                    <Button
                        type="primary"
                        htmlType="submit"
                        form={activeFormId}
                        loading={loading}
                        className="save-lead-form__submit-btn"
                    >
                        {submitLabel}
                        <ArrowRightOutlined />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default LeadForm;
