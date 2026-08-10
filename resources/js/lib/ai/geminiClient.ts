import axios from "axios";

export interface GenerateDescriptionOptions {
    endpoint?: string;
    featureContext?: string;
}

/**
 * Check whether AI description generation is enabled.
 * Enabled by default and can be toggled off via AI_API_KEY.
 */
export function isAiEnabled(): boolean {
    return typeof process !== "undefined" && !!process.env.MIX_AI_API_KEY;
}

// ---------------------------------------------------------------------------
// Field validation
// ---------------------------------------------------------------------------

export interface FieldCheck {
    /** Whether there is enough data to generate a description */
    sufficient: boolean;
    /** Human-readable names of fields the user should fill in first */
    missing: string[];
}

/**
 * Determine whether the form has enough data for a meaningful description.
 *
 * - Standard properties: property_type AND at least ONE of sale_type / price / city.
 * - Construction projects: name (project name) AND at least ONE of
 *   developer name, city, starting_price, or construction_status.
 */
export function getMinimumFieldsPresent(
    formData: Record<string, any>,
): FieldCheck {
    const missing: string[] = [];
    const isConstructionProject =
        formData.primary_category === "construction_project";

    if (isConstructionProject) {
        // Construction projects use "name" instead of "property_type"
        if (!formData.name) {
            missing.push("Project Name");
        }

        const hasContext =
            !!formData.city ||
            (formData.starting_price != null &&
                formData.starting_price !== "" &&
                formData.starting_price !== 0) ||
            !!formData.construction_status;

        if (!hasContext) {
            missing.push(
                "at least one of City, Starting Price, or Construction Status",
            );
        }
    } else {
        // Detect unit-type form context: has total_area_sqm but no sale_type key
        const isUnitType =
            "total_area_sqm" in formData && !("sale_type" in formData);

        if (!formData.property_type) {
            missing.push("Property Type");
        }

        if (isUnitType) {
            // Unit types don't have sale_type or city — accept any specification
            const hasContext =
                (formData.starting_price != null &&
                    formData.starting_price !== "" &&
                    formData.starting_price !== 0) ||
                formData.bedrooms != null ||
                (formData.total_area_sqm != null &&
                    formData.total_area_sqm !== "" &&
                    formData.total_area_sqm !== 0) ||
                (formData.unit_style && formData.unit_style.length > 0) ||
                !!formData.floor;

            if (!hasContext) {
                missing.push(
                    "at least one of Starting Price, Bedrooms, Total Area, Unit Style, or Floor",
                );
            }
        } else {
            const hasContext =
                !!formData.sale_type ||
                (formData.price != null &&
                    formData.price !== "" &&
                    formData.price !== 0) ||
                (formData.starting_price != null &&
                    formData.starting_price !== "" &&
                    formData.starting_price !== 0) ||
                !!formData.city ||
                !!formData.bedrooms;

            if (!hasContext) {
                missing.push(
                    "at least one of Sale Type, Price, City, or Bedrooms",
                );
            }
        }
    }

    return { sufficient: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// User-friendly error mapping
// ---------------------------------------------------------------------------

const USER_FRIENDLY_ERRORS: Record<string, string> = {
    "429": "AI service is temporarily busy. Please wait a moment and try again.",
    "403": "AI service access denied. Please contact your administrator.",
    "401": "AI service authentication failed. Please contact your administrator.",
    "500": "AI service encountered an internal error. Please try again later.",
    "503": "AI service is temporarily unavailable. Please try again later.",
};

const DEFAULT_USER_ERROR = "Failed to generate description. Please try again.";

/**
 * Convert a raw API / network error into a user-friendly message.
 * Technical details are logged to the console for debugging.
 */
export function toUserFriendlyError(err: unknown): string {
    // Always log the full detail for developers
    console.error("[AI Description] Generation failed:", err);

    if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status && USER_FRIENDLY_ERRORS[String(status)]) {
            return USER_FRIENDLY_ERRORS[String(status)];
        }

        if (err.code === "ECONNABORTED") {
            return "AI description request timed out. Please try again.";
        }

        if (!err.response) {
            return "Could not reach the AI service. Please check your connection and try again.";
        }
    }

    const message = (err instanceof Error ? err.message : String(err)) ?? "";

    // Match known HTTP status codes in the error string
    for (const [code, friendly] of Object.entries(USER_FRIENDLY_ERRORS)) {
        if (message.includes(code)) {
            return friendly;
        }
    }

    // Network / connectivity issues
    if (
        message.toLowerCase().includes("fetch") ||
        message.toLowerCase().includes("network") ||
        message.toLowerCase().includes("timeout")
    ) {
        return "Could not reach the AI service. Please check your connection and try again.";
    }

    return DEFAULT_USER_ERROR;
}

/**
 * Call Gemini to generate a property listing description.
 *
 * @param formData – the current form values from PropertyCategoryForm
 * @returns The generated description text
 */
export async function generatePropertyDescription(
    formData: Record<string, any>,
    options: GenerateDescriptionOptions = {},
): Promise<string> {
    const response = await axios.post<{ description: string }>(
        options.endpoint ?? "/account/properties/ai-description",
        {
            form_data: formData,
            feature_context: options.featureContext,
        },
        {
            timeout: 30000,
        },
    );

    const text = String(response.data?.description ?? "").trim();
    if (!text) {
        throw new Error("AI returned an empty response. Please try again.");
    }

    return text;
}
