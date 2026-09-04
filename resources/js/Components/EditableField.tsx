import { useState, useRef, useEffect, useLayoutEffect, useCallback, useContext } from "react";
import {
    Input,
    Typography,
    message,
    Select,
    Skeleton,
    Spin,
    Space,
    Button,
    Upload,
    type SelectProps,
} from "antd";
import {
    CheckOutlined,
    CloseOutlined,
    EditOutlined,
    LoadingOutlined,
    FileOutlined,
    DownloadOutlined,
    DeleteOutlined,
    UploadOutlined,
} from "@ant-design/icons";
import PhoneInput, { PhoneNumber } from "antd-phone-input";
import FormDataSelector from "./FormDataSelector";
import { FormDataType, useCountries, useCurrencies } from "@/Hooks/useFormData";
import useTranslation from "@/Hooks/useTranslation";
import { usePage } from "@inertiajs/react";
import CurrencyInput from "./CurrencyInput";
import CurrencyRangeInput from "./CurrencyRangeInput";
import {
    parsePropertyPrice,
    parseRangeValue,
    parseCurrencyRangeValue,
    formatCurrencyWithSymbol,
    formatCountryForDisplay,
    formatMobileForDisplay,
    serializePhoneInputValue,
    normalizePastedPhoneNumber,
} from "@/lib/utils";
import { parseMultiSelectStoredValue } from "@/lib/parseMultiSelectStoredValue";
import { DetailFieldEditContext } from "./DetailSection";
import DealBadge from "@/Pages/Deals/Redesign/components/primitives/DealBadge";

const { Text } = Typography;

type MultiValueTagRender = NonNullable<SelectProps["tagRender"]>;

const MultiValueTag: MultiValueTagRender = ({ label, closable, onClose }) => {
    return (
        <DealBadge
            variant="navy"
            style={{ marginInlineEnd: 4, marginBlock: 2, maxWidth: "100%" }}
        >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {label}
            </span>
            {closable ? (
                <button
                    type="button"
                    aria-label="Remove"
                    onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                    onClick={(event) => onClose(event)}
                    style={{
                        margin: 0,
                        padding: 0,
                        border: "none",
                        background: "transparent",
                        color: "inherit",
                        cursor: "pointer",
                        lineHeight: 1,
                        fontSize: 14,
                        opacity: 0.7,
                    }}
                >
                    ×
                </button>
            ) : null}
        </DealBadge>
    );
};

interface EditableFieldProps {
    value: any; // supports primitives, arrays, and structured values (e.g. currency {amount,currency})
    fieldName: string;
    fieldType?:
        | "text"
        | "email"
        | "number"
        | "phone"
        | "date"
        | "select"
        | "multiselect"
        | "boolean"
        | "textarea"
        | "country"
        | "multiSelectCountry"
        | "currency"
        | "range"
        | "currency_range"
        | "file";
    selectorType?: FormDataType;
    mode?: "multiple" | "tags";
    onSave: (value: any) => Promise<void>;
    displayValue?: React.ReactNode;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    formatValue?: (value: any) => string;
    options?: { label: string; value: string | number }[];
    loading?: boolean;
    /** When true, the field renders in edit/input mode permanently (for bulk edit mode) */
    alwaysEditing?: boolean;
    /** Called when value changes in alwaysEditing mode (for tracking pending changes) */
    onChange?: (fieldName: string, value: any) => void;
    /** Enter edit mode on a single click instead of the default double-click
     * (v2.2's click-to-edit pattern — opt-in so existing double-click
     * consumers elsewhere in the app are unaffected). */
    activateOnSingleClick?: boolean;
}

/** Wrap + clip long display values; offer "Show more" when content overflows. */
function ClampedText({
    text,
    textClassName = "",
    trailing,
}: {
    text: React.ReactNode;
    textClassName?: string;
    trailing?: React.ReactNode;
}) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const [canExpand, setCanExpand] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const measureOverflow = useCallback(() => {
        const el = contentRef.current;
        if (!el || expanded) {
            setCanExpand(expanded);
            return;
        }
        // Analysis/Qualify modals disable line-clamp via CSS; skip the
        // expand control so ResizeObserver false-positives don't flash
        // a "Show more" on short values.
        const clamp = getComputedStyle(el).webkitLineClamp;
        if (!clamp || clamp === "none") {
            setCanExpand(false);
            return;
        }
        setCanExpand(el.scrollHeight > el.clientHeight + 1);
    }, [expanded]);

    useLayoutEffect(() => {
        measureOverflow();
    }, [text, expanded, measureOverflow]);

    useEffect(() => {
        const el = contentRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(() => measureOverflow());
        observer.observe(el);
        return () => observer.disconnect();
    }, [measureOverflow]);

    return (
        <div className="min-w-0 max-w-full">
            {/* inline-flex keeps underline + pencil to the value width;
                hover reveal is driven by the parent DetailField `group` */}
            <div className="inline-flex max-w-full items-start gap-1.5">
                <div
                    ref={contentRef}
                    className={`max-w-full break-words whitespace-normal [overflow-wrap:anywhere] ${
                        expanded ? "" : "line-clamp-3"
                    } ${textClassName}`}
                >
                    {text}
                </div>
                {trailing}
            </div>
            {canExpand && (
                <button
                    type="button"
                    className="mt-0.5 block cursor-pointer text-xs font-medium text-blue-800 hover:underline"
                    onClick={(event) => {
                        event.stopPropagation();
                        setExpanded((prev) => !prev);
                    }}
                >
                    {expanded
                        ? t("pages.deals.common.show_less")
                        : t("pages.deals.common.show_more")}
                </button>
            )}
        </div>
    );
}

type CountryOption = {
    iso?: string;
    phonecode?: string | number;
};

function resolvePhoneCountryIso(
    phoneStr: string,
    countries: CountryOption[],
): string {
    if (!phoneStr?.startsWith("+")) return "";

    const phoneWithoutPlus = phoneStr.substring(1);
    for (let len = 4; len >= 1; len--) {
        const potentialCode = phoneWithoutPlus.substring(0, len);
        const matchingCountry = countries.find(
            (country) =>
                country.phonecode?.toString() === potentialCode ||
                country.phonecode === parseInt(potentialCode, 10),
        );
        if (matchingCountry?.iso) {
            return matchingCountry.iso.toLowerCase();
        }
    }

    // Empty → PhoneInput keeps its timezone default. Never force "af":
    // that short mask truncates many international pastes.
    return "";
}

/**
 * Phone editor that remounts after paste so antd-phone-input re-initializes
 * with the full number. Its active-country mask otherwise clips pasted digits
 * that don't fit (often the last 1–2 digits).
 */
function PhoneFieldInput({
    value,
    countries,
    placeholder,
    disabled,
    onValueChange,
    onBlur,
    onKeyDown,
}: {
    value: string | PhoneNumber | undefined;
    countries: CountryOption[];
    placeholder?: string;
    disabled?: boolean;
    onValueChange: (value: string) => void;
    onBlur: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
}) {
    const [remountKey, setRemountKey] = useState(0);
    const stringValue = typeof value === "string" ? value : "";
    const countryProp = resolvePhoneCountryIso(stringValue, countries);

    return (
        <PhoneInput
            key={remountKey}
            value={value}
            onChange={(val) => {
                if (val && typeof val === "object" && "phoneNumber" in val) {
                    onValueChange(serializePhoneInputValue(val, value));
                } else if (typeof val === "string") {
                    onValueChange(val);
                } else {
                    onValueChange(val as unknown as string);
                }
            }}
            onPaste={(event) => {
                const pasted = event.clipboardData?.getData("text") ?? "";
                const normalized = normalizePastedPhoneNumber(pasted);
                if (!normalized) return;

                // International / long pastes: bypass the active mask entirely.
                const pastedDigits = pasted.replace(/\D/g, "");
                const trimmedPaste = pasted.trim();
                const looksInternational =
                    trimmedPaste.startsWith("+") ||
                    trimmedPaste.startsWith("00") ||
                    (pastedDigits.length >= 11 && !pastedDigits.startsWith("0"));
                if (!looksInternational) return;

                event.preventDefault();
                event.stopPropagation();
                onValueChange(normalized);
                setRemountKey((key) => key + 1);
            }}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="flex-1"
            disabled={disabled}
            enableSearch
            allowClear
            {...(countryProp ? { country: countryProp } : {})}
        />
    );
}

export default function EditableField({
    value,
    fieldName,
    fieldType = "text",
    selectorType,
    mode,
    onSave,
    displayValue,
    placeholder = "Click to edit",
    className = "",
    disabled = false,
    formatValue,
    options = [],
    loading = false,
    alwaysEditing = false,
    onChange,
    activateOnSingleClick = false,
}: EditableFieldProps) {
    const { props } = usePage<any>();
    const { countries } = useCountries();
    const { currencies } = useCurrencies();
    const {
        default_currency_code,
        default_currency_symbol,
    } = props;

    const maxFileSizeMB = props?.company?.allowed_file_size || 10;
    const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
    // Normalize country/phone so they never render as [object Object] in view or edit mode
    const normalizedValue =
        fieldType === "country" && value !== undefined && value !== null
            ? formatCountryForDisplay(value)
            : fieldType === "phone" && value !== undefined && value !== null
              ? formatMobileForDisplay(value)
              : value;
    const [editing, setEditing] = useState(alwaysEditing);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    const defaultCurrencyCode = default_currency_code || "TRY";

    const normalizeCurrencyValue = useCallback(
        (val: any): { amount: number | null; currency: string } => {
            if (val === null || val === undefined) {
                return { amount: null, currency: defaultCurrencyCode };
            }

            if (
                typeof val === "object" &&
                !Array.isArray(val) &&
                ("amount" in val || "currency" in val)
            ) {
                return {
                    amount:
                        val.amount !== null &&
                        val.amount !== undefined &&
                        val.amount !== ""
                            ? typeof val.amount === "number"
                                ? val.amount
                                : Number(val.amount)
                            : null,
                    currency: val.currency || defaultCurrencyCode,
                };
            }

            if (typeof val === "string") {
                const numValue = Number(val);
                if (!isNaN(numValue)) {
                    return { amount: numValue, currency: defaultCurrencyCode };
                }

                try {
                    const parsed = JSON.parse(val);
                    if (typeof parsed === "number") {
                        return {
                            amount: parsed,
                            currency: defaultCurrencyCode,
                        };
                    }
                    if (typeof parsed === "object" && !Array.isArray(parsed)) {
                        return {
                            amount:
                                parsed.amount !== null &&
                                parsed.amount !== undefined &&
                                parsed.amount !== ""
                                    ? typeof parsed.amount === "number"
                                        ? parsed.amount
                                        : Number(parsed.amount)
                                    : null,
                            currency: parsed.currency || defaultCurrencyCode,
                        };
                    }
                } catch {
                    // ignore
                }
                return { amount: null, currency: defaultCurrencyCode };
            }

            if (typeof val === "number") {
                return { amount: val, currency: defaultCurrencyCode };
            }

            return { amount: null, currency: defaultCurrencyCode };
        },
        [defaultCurrencyCode],
    );

    const getInitialValue = () => {
        if (fieldType === "currency") {
            return normalizeCurrencyValue(value);
        }
        if (fieldType === "range") {
            return parseRangeValue(value);
        }
        if (fieldType === "currency_range") {
            return parseCurrencyRangeValue(value, defaultCurrencyCode);
        }
        return value;
    };

    const isMultiSelectField =
        fieldType === "multiselect" ||
        fieldType === "multiSelectCountry" ||
        mode === "multiple" ||
        mode === "tags";

    const [inputValue, setInputValue] = useState<any>(() => {
        if (isMultiSelectField || Array.isArray(value)) {
            return parseMultiSelectStoredValue(value);
        }
        return getInitialValue();
    });
    const isManuallySettingValue = useRef(false);
    const previousValueRef = useRef<string>("");
    const previousEditingRef = useRef(editing);
    // Content-stable key so parent re-parses (new array refs, same data) do not
    // wipe in-progress multiselect edits when liveValues/pendingChanges re-render.
    const previousMultiValueKeyRef = useRef(
        JSON.stringify(
            isMultiSelectField || Array.isArray(value)
                ? parseMultiSelectStoredValue(value)
                : null,
        ),
    );

    useEffect(() => {
        if (isManuallySettingValue.current) {
            isManuallySettingValue.current = false;
            if (fieldType === "currency") {
                const normalized = normalizeCurrencyValue(value);
                previousValueRef.current = `${normalized.amount}_${normalized.currency}`;
            }
            previousEditingRef.current = editing;
            return;
        }

        const justExitedEditMode = previousEditingRef.current && !editing;
        previousEditingRef.current = editing;

        if (fieldType === "currency") {
            const normalized = normalizeCurrencyValue(value);
            const valueKey = `${normalized.amount}_${normalized.currency}`;

            if (previousValueRef.current !== valueKey || justExitedEditMode) {
                previousValueRef.current = valueKey;
                setInputValue(normalized);
            }
        } else if (!editing) {
            const valueKey =
                typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value);
            if (previousValueRef.current !== valueKey || justExitedEditMode) {
                previousValueRef.current = valueKey;
                setInputValue(value);
            }
        }
    }, [
        value,
        fieldType,
        defaultCurrencyCode,
        editing,
        normalizeCurrencyValue,
    ]);

    const isClickingActionRef = useRef(false);
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track when alwaysEditing mode changes or value changes from parent
    useEffect(() => {
        if (alwaysEditing) {
            isManuallySettingValue.current = true;
            setEditing(true);
        } else {
            setEditing(false);
        }
    }, [alwaysEditing]);

    // Update inputValue when value prop changes (e.g., after save or when deal data updates).
    // Currency fields are managed by the dedicated normalization effect above so they are not
    // reset on every parent render while the user types in always-edit mode.
    // Multiselect/country arrays are compared by content — CustomFieldDisplay re-parses
    // stored values into a new array on every render, which must not reset local edits.
    useEffect(() => {
        if (fieldType === "date" && normalizedValue) {
            try {
                const date = new Date(String(normalizedValue));
                if (!isNaN(date.getTime())) {
                    setInputValue(date.toISOString().split("T")[0]);
                } else {
                    setInputValue("");
                }
            } catch {
                setInputValue("");
            }
        } else if (
            fieldType === "multiselect" ||
            fieldType === "multiSelectCountry" ||
            Array.isArray(normalizedValue)
        ) {
            const next = parseMultiSelectStoredValue(normalizedValue);
            const nextKey = JSON.stringify(next);
            if (previousMultiValueKeyRef.current === nextKey) {
                return;
            }
            previousMultiValueKeyRef.current = nextKey;
            setInputValue(next);
        } else if (fieldType === "currency") {
            return;
        } else if (fieldType === "range") {
            setInputValue(parseRangeValue(normalizedValue));
        } else if (fieldType === "currency_range") {
            setInputValue(parseCurrencyRangeValue(normalizedValue, defaultCurrencyCode));
        } else {
            setInputValue(normalizedValue ?? "");
        }
    }, [normalizedValue, fieldType, defaultCurrencyCode]);

    const isLocked = loading || saving;

    const canStartEditing = !isLocked && !disabled && fieldType !== "file";

    const startEditing = () => {
        if (!canStartEditing) return;
        isManuallySettingValue.current = true;
        setEditing(true);
        if (fieldType === "date" && normalizedValue) {
            try {
                const date = new Date(String(normalizedValue));
                if (!isNaN(date.getTime())) {
                    setInputValue(date.toISOString().split("T")[0]);
                } else {
                    setInputValue("");
                }
            } catch {
                setInputValue("");
            }
        } else if (
            fieldType === "multiselect" ||
            fieldType === "multiSelectCountry" ||
            Array.isArray(normalizedValue)
        ) {
            setInputValue(parseMultiSelectStoredValue(normalizedValue));
        } else if (fieldType === "currency") {
            setInputValue(normalizeCurrencyValue(normalizedValue));
        } else if (fieldType === "range") {
            setInputValue(parseRangeValue(normalizedValue));
        } else if (fieldType === "currency_range") {
            setInputValue(parseCurrencyRangeValue(normalizedValue, defaultCurrencyCode));
        } else {
            setInputValue(normalizedValue ?? "");
        }
    };

    // Keep a stable ref to startEditing so the context registration never goes stale
    const startEditingRef = useRef(startEditing);
    startEditingRef.current = startEditing;

    // Register/unregister with the nearest parent DetailField via context —
    // this is what makes DetailField show its own pencil next to the label.
    // Skipped in v2.2 mode (activateOnSingleClick): that mode already shows
    // its own pencil next to the value below, so registering here would
    // double up (a second pencil beside the label, not in v2.2).
    const detailFieldCtx = useContext(DetailFieldEditContext);
    useEffect(() => {
        if (!detailFieldCtx) return;
        if (activateOnSingleClick) {
            detailFieldCtx.setEditHandler(null);
            detailFieldCtx.setIsEditing(editing);
            return () => {
                detailFieldCtx.setEditHandler(null);
                detailFieldCtx.setIsEditing(false);
            };
        }
        if (canStartEditing && !editing) {
            detailFieldCtx.setEditHandler(() => startEditingRef.current());
        } else {
            detailFieldCtx.setEditHandler(null);
        }
        detailFieldCtx.setIsEditing(editing);
        return () => {
            detailFieldCtx.setEditHandler(null);
            detailFieldCtx.setIsEditing(false);
        };
    }, [detailFieldCtx, canStartEditing, editing, activateOnSingleClick]);

    const handleSave = async () => {
        // Clear any pending blur timeout to prevent double save
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }

        // Compare values properly for arrays and files (use normalizedValue for country/phone)
        const isArrayValue =
            Array.isArray(normalizedValue) || Array.isArray(inputValue);
        const isFileValue = inputValue instanceof File;
        const valuesEqual = isFileValue
            ? false
            : isArrayValue
              ? JSON.stringify(inputValue) === JSON.stringify(normalizedValue)
              : inputValue === normalizedValue;

        if (valuesEqual) {
            // In always editing mode, don't exit edit mode even if values are same
            if (!alwaysEditing) {
                setEditing(false);
            }
            return;
        }

        if (
            fieldType === "email" &&
            typeof inputValue === "string" &&
            inputValue.trim() &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputValue.trim())
        ) {
            message.error("Please enter a valid email address");
            return;
        }

        setSaving(true);
        try {
            await onSave(inputValue);
            if (!alwaysEditing) {
                setEditing(false);
            }
            message.success("Field updated successfully");
        } catch (error: any) {
            message.error(
                error?.message || "Failed to update field. Please try again.",
            );
        } finally {
            setSaving(false);
        }
    };

    // Handle blur - only save if not clicking on action buttons
    // When alwaysEditing is true, don't auto-save on blur
    const handleBlur = () => {
        // In always editing mode, don't auto-save on blur
        if (alwaysEditing) {
            return;
        }

        // Clear any existing timeout first
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
        }

        // Use setTimeout to allow mousedown on action buttons to set the flag first
        blurTimeoutRef.current = setTimeout(() => {
            if (!isClickingActionRef.current) {
                handleSave();
            }
            // Reset the flag
            isClickingActionRef.current = false;
            blurTimeoutRef.current = null;
        }, 100);
    };

    const handleCancel = () => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
        isClickingActionRef.current = false;
        if (!alwaysEditing) {
            setEditing(false);
        }
        if (
            fieldType === "multiselect" ||
            fieldType === "multiSelectCountry" ||
            Array.isArray(normalizedValue)
        ) {
            setInputValue(
                Array.isArray(normalizedValue)
                    ? normalizedValue
                    : normalizedValue
                      ? [normalizedValue]
                      : [],
            );
        } else if (fieldType === "currency") {
            setInputValue(normalizeCurrencyValue(normalizedValue));
        } else if (fieldType === "range") {
            setInputValue(parseRangeValue(normalizedValue));
        } else if (fieldType === "currency_range") {
            setInputValue(parseCurrencyRangeValue(normalizedValue, defaultCurrencyCode));
        } else {
            setInputValue(normalizedValue ?? "");
        }
    };

    // Handle action button mousedown - set flag to prevent blur from saving
    const handleActionMouseDown = () => {
        isClickingActionRef.current = true;
    };

    // Handle input value change - update state and notify parent in alwaysEditing mode
    const handleValueChange = (newValue: any) => {
        // Ant Select mode="multiple" emits undefined when the last item is cleared.
        const nextValue =
            isMultiSelectField && (newValue == null || newValue === undefined)
                ? []
                : newValue;
        setInputValue(nextValue);
        if (alwaysEditing && onChange) {
            onChange(fieldName, nextValue);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSave();
        } else if (e.key === "Escape") {
            handleCancel();
        }
    };

    const handleFileUpload = async (file: File) => {
        if (file.size > maxFileSizeBytes) {
            message.error(
                `File size exceeds the maximum allowed size of ${maxFileSizeMB}MB`,
            );
            return false;
        }

        setUploading(true);
        try {
            await onSave(file);
            message.success("File uploaded successfully");
        } catch (error: any) {
            if (error?.response?.status === 413) {
                message.error(
                    `File is too large. Maximum allowed size is ${maxFileSizeMB}MB. Please check your server's upload_max_filesize and post_max_size settings.`,
                );
            } else {
                message.error("Failed to upload file");
            }
        } finally {
            setUploading(false);
        }
        return false;
    };

    const handleFileRemove = async () => {
        setUploading(true);
        try {
            await onSave("");
            message.success("File removed successfully");
        } catch (error) {
            message.error("Failed to remove file");
        } finally {
            setUploading(false);
        }
    };

    // Check if file field is loading
    const isFileLoading = loading || uploading;

    const renderFileField = () => {
        if (isFileLoading) {
            return <Spin size="small" indicator={<LoadingOutlined spin />} />;
        }

        if (value && typeof value === "string") {
            // External FileStorageService uploads store the full download URL;
            // legacy uploads store a bare filename under hibarr_fields/.
            const trimmed = value.trim();
            const isExternalUrl =
                trimmed.startsWith("http://") || trimmed.startsWith("https://");
            const fileUrl = isExternalUrl
                ? trimmed
                : `/user-uploads/hibarr_fields/${trimmed}`;
            const displayName = isExternalUrl
                ? trimmed.split("/").pop()?.split("?")[0] || "file"
                : trimmed;
            const downloadLabel = displayName
                ? `Download file ${displayName}`
                : "Download file";
            const deleteLabel = displayName
                ? `Delete file ${displayName}`
                : "Delete file";
            return (
                <div className="flex flex-col gap-1">
                    <a
                        href={fileUrl}
                        className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <FileOutlined className="mr-1" />
                        View File
                    </a>
                    <Space size="small">
                        <a
                            href={fileUrl}
                            className="text-blue-600 hover:text-blue-800"
                            download
                            title="Download"
                            aria-label={downloadLabel}
                        >
                            <DownloadOutlined />
                        </a>
                        {!disabled && (
                            <Button
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={handleFileRemove}
                                title="Delete"
                                aria-label={deleteLabel}
                            />
                        )}
                    </Space>
                </div>
            );
        }

        if (fieldType === "currency") {
            // Parse and format currency value for display
            const parsed = parsePropertyPrice(
                value,
                default_currency_code || "TRY",
            );
            const symbol =
                currencies.find(
                    (c: any) => c?.currency_code === parsed.currency,
                )?.currency_symbol ||
                default_currency_symbol ||
                "";
            return formatCurrencyWithSymbol(parsed.amount, symbol);
        }
        if (disabled) {
            return <span className="text-gray-500">--</span>;
        }
        return normalizedValue?.toString() || "--";
    };

    // For file fields, always render the permanent UI (like CustomFieldDisplay)
    // File fields don't have an "editing" mode - they're always available for upload/delete
    if (fieldType === "file") {
        return renderFileField();
    }

    const displayText =
        displayValue !== undefined
            ? displayValue
            : fieldType === "currency"
              ? (() => {
                    const parsed = parsePropertyPrice(
                        value,
                        defaultCurrencyCode,
                    );
                    const symbol =
                        currencies.find(
                            (c: any) => c?.currency_code === parsed.currency,
                        )?.currency_symbol ??
                        default_currency_symbol ??
                        "";
                    return formatCurrencyWithSymbol(parsed.amount, symbol);
                })()
              : fieldType === "range"
                ? (() => {
                      const parsed = parseRangeValue(value);
                      if (parsed.min == null && parsed.max == null) {
                          // Legacy value that predates this field being a
                          // structured range — show it as-is rather than
                          // hiding it as "unset". Editing re-saves it in the
                          // new {min,max} shape.
                          return typeof value === "string" && value.trim()
                              ? value
                              : "--";
                      }
                      const fmt = (n: number | null) =>
                          n == null ? "?" : n.toLocaleString();
                      return `${fmt(parsed.min)} – ${fmt(parsed.max)}`;
                  })()
                : fieldType === "currency_range"
                  ? (() => {
                        const parsed = parseCurrencyRangeValue(
                            value,
                            defaultCurrencyCode,
                        );
                        if (parsed.min == null && parsed.max == null) {
                            return typeof value === "string" && value.trim()
                                ? value
                                : "--";
                        }
                        const symbol =
                            currencies.find(
                                (c: any) => c?.currency_code === parsed.currency,
                            )?.currency_symbol ??
                            default_currency_symbol ??
                            "";
                        const fmt = (n: number | null) =>
                            n == null ? "?" : `${symbol}${n.toLocaleString()}`;
                        return `${fmt(parsed.min)} – ${fmt(parsed.max)}`;
                    })()
                  : formatValue
                ? formatValue(normalizedValue)
                : normalizedValue?.toString() ||
                  (activateOnSingleClick ? placeholder : "--");

    // v2.2 renders the empty placeholder in muted italics so it reads as a
    // placeholder, not a real value. Only applies when this component
    // generated the fallback text itself — a caller-supplied
    // displayValue/currency format manages its own styling.
    // Empty arrays (multiselect) are truthy in JS, so they must be checked
    // by length — otherwise "Click to edit" renders as a real value.
    const isEmptyValue =
        activateOnSingleClick &&
        displayValue === undefined &&
        fieldType !== "currency" &&
        (normalizedValue == null ||
            normalizedValue === "" ||
            (Array.isArray(normalizedValue) && normalizedValue.length === 0));

    if (editing) {
        return (
            <Spin
                spinning={saving}
                indicator={<LoadingOutlined spin />}
                size="small"
                wrapperClassName="w-full"
            >
                <div className="flex items-center gap-2 w-full">
                    {selectorType ? (
                        <FormDataSelector
                            type={selectorType}
                            value={inputValue}
                            onChange={(val) => handleValueChange(val)}
                            mode={mode} // Pass mode
                            className="flex-1 min-w-[200px]"
                            disabled={saving || loading}
                            // autoFocus
                            // isOpen={true} // Add prop to force open if possible, but FormDataSelector wraps Select which has defaultOpen
                            // FormDataSelector doesn't have autoFocus prop, but Select has.
                            // We might need to handle focus or defaultOpen in FormDataSelector
                        />
                    ) : fieldType === "number" ? (
                        <Input
                            type="number"
                            value={inputValue}
                            onChange={(e) => handleValueChange(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyPress}
                            autoFocus
                            className="flex-1"
                            disabled={saving || loading}
                        />
                    ) : fieldType === "email" ? (
                        <Input
                            type="email"
                            value={inputValue}
                            onChange={(e) => handleValueChange(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyPress}
                            autoFocus
                            className="flex-1"
                            disabled={saving || loading}
                        />
                    ) : fieldType === "phone" ? (
                        <PhoneFieldInput
                            value={
                                typeof inputValue === "string"
                                    ? inputValue
                                    : (inputValue as PhoneNumber | undefined)
                            }
                            countries={countries}
                            placeholder={placeholder}
                            disabled={saving || loading}
                            onValueChange={handleValueChange}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyPress}
                        />
                    ) : fieldType === "date" ? (
                        <Input
                            type="date"
                            value={inputValue}
                            onChange={(e) => handleValueChange(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyPress}
                            autoFocus
                            className="flex-1"
                            disabled={saving || loading}
                        />
                    ) : fieldType === "select" ? (
                        <Select
                            value={inputValue}
                            onChange={(val) => handleValueChange(val)}
                            options={options}
                            className="flex-1 min-w-[120px]"
                            disabled={saving || loading}
                            // Auto-open only for the deliberate single-field
                            // click-to-edit case — in bulk "edit whole
                            // section" mode (alwaysEditing) every select
                            // field enters edit simultaneously, so forcing
                            // them all open at once would be a wall of
                            // dropdowns nobody asked to see.
                            defaultOpen={!alwaysEditing}
                            allowClear
                        />
                    ) : fieldType === "multiselect" ? (
                        <Select
                            value={Array.isArray(inputValue) ? inputValue : []}
                            onChange={(val) => handleValueChange(val)}
                            options={options}
                            mode="multiple"
                            className="flex-1 min-w-[200px]"
                            disabled={saving || loading}
                            defaultOpen={!alwaysEditing}
                            allowClear
                            placeholder="Select options..."
                            tagRender={MultiValueTag}
                        />
                    ) : fieldType === "boolean" ? (
                        <Select
                            value={inputValue}
                            onChange={(val) => handleValueChange(val)}
                            options={[
                                { label: "Yes", value: 1 },
                                { label: "No", value: 0 },
                            ]}
                            className="flex-1 min-w-[80px]"
                            disabled={saving || loading}
                            defaultOpen={!alwaysEditing}
                        />
                    ) : fieldType === "textarea" ? (
                        <Input.TextArea
                            value={inputValue}
                            onChange={(e) => handleValueChange(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSave();
                                } else if (e.key === "Escape") {
                                    handleCancel();
                                }
                            }}
                            autoFocus
                            className="flex-1"
                            disabled={saving || loading}
                            autoSize={{ minRows: 2, maxRows: 6 }}
                        />
                    ) : fieldType === "country" ? (
                        <Select
                            value={inputValue}
                            onChange={(val) => handleValueChange(val)}
                            className="flex-1 min-w-[200px]"
                            disabled={saving || loading}
                            defaultOpen={!alwaysEditing}
                            allowClear
                            showSearch
                            placeholder="Select country"
                            filterOption={(input, option) => {
                                const searchText = input.toLowerCase();
                                const countryValue = option?.value as string;
                                const country = countries?.find(
                                    (c: any) => c.nicename === countryValue,
                                );

                                if (!country) return false;

                                // Search by nicename, name, iso, iso3, or nationality
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
                            {countries && countries.length > 0 ? (
                                countries.map((country: any) => (
                                    <Select.Option
                                        key={country.iso || country.id}
                                        value={country.nicename}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span
                                                className={`flag-icon flag-icon-${country.iso?.toLowerCase()} mr-1`}
                                            />
                                            {country.nicename}
                                            {country.nationality &&
                                                country.nationality !==
                                                    "unknown" && (
                                                    <span className="text-gray-500 text-xs">
                                                        ({country.nationality})
                                                    </span>
                                                )}
                                        </span>
                                    </Select.Option>
                                ))
                            ) : (
                                <Select.Option disabled value="">
                                    No countries available
                                </Select.Option>
                            )}
                        </Select>
                    ) : fieldType === "multiSelectCountry" ? (
                        <Select
                            mode="multiple"
                            value={Array.isArray(inputValue) ? inputValue : []}
                            onChange={(val) => handleValueChange(val)}
                            className="flex-1 min-w-[200px]"
                            disabled={saving || loading}
                            defaultOpen={!alwaysEditing}
                            allowClear
                            showSearch
                            placeholder="Select countries"
                            tagRender={MultiValueTag}
                            filterOption={(input, option) => {
                                const searchText = input.toLowerCase();
                                const countryValue = option?.value as string;
                                const country = countries?.find(
                                    (c: any) => c.nicename === countryValue,
                                );

                                if (!country) return false;

                                // Search by nicename, name, iso, iso3, or nationality
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
                            {countries && countries.length > 0 ? (
                                countries.map((country: any) => (
                                    <Select.Option
                                        key={country.iso || country.id}
                                        value={country.nicename}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span
                                                className={`flag-icon flag-icon-${country.iso?.toLowerCase()} mr-1`}
                                            />
                                            {country.nicename}
                                            {country.nationality &&
                                                country.nationality !==
                                                    "unknown" && (
                                                    <span className="text-gray-500 text-xs">
                                                        ({country.nationality})
                                                    </span>
                                                )}
                                        </span>
                                    </Select.Option>
                                ))
                            ) : (
                                <Select.Option disabled value="">
                                    No countries available
                                </Select.Option>
                            )}
                        </Select>
                    ) : fieldType === "currency" ? (
                        <div className="flex items-center gap-2">
                            <CurrencyInput
                                value={inputValue}
                                onChange={(val) => handleValueChange(val)}
                                onBlur={handleBlur}
                                onKeyDown={handleKeyPress}
                                placeholder="Enter amount"
                                noFormItem={true}
                                disabled={saving || loading}
                            />
                        </div>
                    ) : fieldType === "range" ? (
                        <div className="flex items-center gap-2 flex-1">
                            <Input
                                type="number"
                                min={0}
                                value={inputValue?.min ?? ""}
                                placeholder="Min"
                                onChange={(e) =>
                                    handleValueChange({
                                        ...inputValue,
                                        min:
                                            e.target.value === ""
                                                ? null
                                                : Number(e.target.value),
                                    })
                                }
                                onBlur={handleBlur}
                                onKeyDown={handleKeyPress}
                                autoFocus
                                className="flex-1"
                                disabled={saving || loading}
                            />
                            <span className="text-gray-400">–</span>
                            <Input
                                type="number"
                                min={0}
                                value={inputValue?.max ?? ""}
                                placeholder="Max"
                                onChange={(e) =>
                                    handleValueChange({
                                        ...inputValue,
                                        max:
                                            e.target.value === ""
                                                ? null
                                                : Number(e.target.value),
                                    })
                                }
                                onBlur={handleBlur}
                                onKeyDown={handleKeyPress}
                                className="flex-1"
                                disabled={saving || loading}
                            />
                        </div>
                    ) : fieldType === "currency_range" ? (
                        <div className="flex-1" onBlur={handleBlur} onKeyDown={handleKeyPress}>
                            <CurrencyRangeInput
                                value={inputValue}
                                onChange={(val) => handleValueChange(val)}
                                disabled={saving || loading}
                            />
                        </div>
                    ) : (
                        <Input
                            value={inputValue}
                            onChange={(e) => handleValueChange(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyPress}
                            autoFocus={!alwaysEditing}
                            className="flex-1"
                            disabled={saving || loading}
                        />
                    )}
                    {/* Hide individual Save/Cancel buttons when in alwaysEditing mode */}
                    {!alwaysEditing && (
                        <>
                            <CheckOutlined
                                onMouseDown={handleActionMouseDown}
                                onClick={
                                    saving || loading ? undefined : handleSave
                                }
                                className={`${
                                    saving || loading
                                        ? "cursor-not-allowed opacity-50 pointer-events-none"
                                        : "cursor-pointer text-green-600 hover:text-green-700"
                                }`}
                                aria-disabled={saving || loading}
                            />
                            <CloseOutlined
                                onMouseDown={handleActionMouseDown}
                                onClick={
                                    saving || loading ? undefined : handleCancel
                                }
                                className={`${
                                    saving || loading
                                        ? "cursor-not-allowed opacity-50 pointer-events-none"
                                        : "cursor-pointer text-red-600 hover:text-red-700"
                                }`}
                                aria-disabled={saving || loading}
                            />
                        </>
                    )}
                </div>
            </Spin>
        );
    }

    // v2.2 mode (activateOnSingleClick): dashed underline + pencil beside the
    // value, single click to edit — no DetailField label-pencil (see the
    // context registration above). Everything else keeps its original look:
    // plain text, double-click, and DetailField's own label-pencil.
    if (!activateOnSingleClick) {
        return (
            <Skeleton active loading={loading || saving} paragraph={{ rows: 1 }}>
                <div
                    className={`w-full min-w-0 ${
                        isLocked ? "cursor-not-allowed opacity-50" : ""
                    } ${className}`}
                    onDoubleClick={canStartEditing ? startEditing : undefined}
                >
                    <ClampedText text={displayText} />
                </div>
            </Skeleton>
        );
    }

    return (
        <Skeleton active loading={loading || saving} paragraph={{ rows: 1 }}>
            <div
                className={`w-full min-w-0 ${
                    isLocked ? "cursor-not-allowed opacity-50" : ""
                } ${canStartEditing ? "cursor-pointer" : ""} ${className}`}
                onClick={canStartEditing ? startEditing : undefined}
                onDoubleClick={canStartEditing ? startEditing : undefined}
            >
                <ClampedText
                    text={displayText}
                    textClassName={`border-b border-dashed ${
                        canStartEditing
                            ? "border-transparent transition-colors group-hover:border-blue-300"
                            : ""
                    } ${isEmptyValue ? "italic text-gray-400" : ""}`}
                    trailing={
                        canStartEditing ? (
                            // Revealed on hover/focus of the enclosing `group`
                            // (DetailField, or the lead dossier row). Opacity,
                            // not `hidden`: antd's own `.anticon{display:inline-flex}`
                            // has the same specificity as Tailwind's `.hidden`
                            // and loads later, so a display-based hide never
                            // took effect and the pencil showed permanently.
                            <EditOutlined
                                aria-hidden="true"
                                className="mt-1 inline-flex shrink-0 text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                                style={{ fontSize: 11 }}
                            />
                        ) : undefined
                    }
                />
            </div>
        </Skeleton>
    );
}
