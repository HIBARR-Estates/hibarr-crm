import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Check whether AI description generation is enabled.
 * Enabled when MIX_GEMINI_API_KEY is set in the environment.
 */
export function isAiEnabled(): boolean {
    return !!process?.env?.MIX_GEMINI_API_KEY;
}

// ---------------------------------------------------------------------------
// Field validation
// ---------------------------------------------------------------------------

interface FieldCheck {
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
        if (!formData.property_type) {
            missing.push("Property Type");
        }

        const hasContext =
            !!formData.sale_type ||
            (formData.price != null &&
                formData.price !== "" &&
                formData.price !== 0) ||
            !!formData.city;

        if (!hasContext) {
            missing.push("at least one of Sale Type, Price, or City");
        }
    }

    return { sufficient: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/** Map form keys to human-readable labels for the prompt. */
const FIELD_LABELS: Record<string, string> = {
    // Standard property fields
    property_type: "Property Type",
    primary_category: "Category",
    unit_style: "Unit Style",
    sale_type: "Listing Type",
    price: "Asking Price",
    city: "City",
    area: "Area / Neighbourhood",
    bedrooms: "Bedrooms",
    bathrooms: "Bathrooms",
    living_room: "Living Rooms",
    living_area_sqm: "Internal Area (m²)",
    gross_sqm: "Gross Area (m²)",
    land_size: "Plot Size (m²)",
    floor_number: "Floor",
    floors_in_building: "Floors in Building",
    building_age: "Building Age",
    furniture_status: "Furniture Status",
    construction_status: "Construction Status",
    interior_features: "Interior Features",
    exterior_features: "Exterior Features",
    location_features: "Location Features",
    view_types: "View",
    heating_type: "Heating Type",
    balcony_net_sqm: "Balcony / Terrace Area (m²)",
    within_site: "Within a Residence / Project",
    // Construction project fields
    name: "Project Name",
    starting_price: "Starting Price",
    number_of_units: "Number of Units",
    number_of_blocks: "Number of Blocks",
    project_total_area_sqm: "Total Project Area (m²)",
    number_of_phases: "Number of Phases",
    furniture_package: "Furniture Package",
    rental_guarantee: "Rental Guarantee",
    facilities: "Facilities",
    primary_categories: "Property Types Available",
    title_deed_type: "Title Deed Type",
};

/**
 * Build a context string from the form data.
 * Only includes fields that have non-empty values.
 */
function buildPropertyContext(formData: Record<string, any>): string {
    const lines: string[] = [];

    for (const [key, label] of Object.entries(FIELD_LABELS)) {
        const value = formData[key];
        if (value == null || value === "" || value === false) continue;

        if (Array.isArray(value)) {
            if (value.length === 0) continue;
            lines.push(`${label}: ${value.join(", ")}`);
        } else if (typeof value === "boolean") {
            lines.push(`${label}: Yes`);
        } else {
            lines.push(`${label}: ${value}`);
        }
    }

    return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Gemini call
// ---------------------------------------------------------------------------

const SYSTEM_INSTRUCTION = `You are a professional real estate copywriter specialising in North Cyprus (TRNC) properties.

Rules:
- Write a compelling property listing description in English.
- Length: 150-300 words.
- Tone: professional, warm, and inviting — suitable for an international buyer audience.
- Highlight key selling points based on the provided details.
- Mention location and lifestyle benefits when the city/area is known.
- If this is a construction project, focus on the development as a whole — mention the developer, project scale, available unit types, facilities, payment plans, and completion timeline where available.
- Do NOT invent features that are not listed — only embellish what is provided.
- Do NOT include a title/heading — return only the body description.
- Output plain text only (no markdown, no bullet points, no HTML).`;

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
): Promise<string> {
    const apiKey = process?.env?.MIX_GEMINI_API_KEY as string;
    if (!apiKey) {
        throw new Error("AI description generation is not configured.");
    }

    const context = buildPropertyContext(formData);
    if (!context) {
        throw new Error(
            "No property details available to generate a description.",
        );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: SYSTEM_INSTRUCTION,
    });

    const result = await model.generateContent(
        `Generate a property listing description based on these details:\n\n${context}`,
    );

    const text = result.response.text().trim();
    if (!text) {
        throw new Error("AI returned an empty response. Please try again.");
    }

    return text;
}
