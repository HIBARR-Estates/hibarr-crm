import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Check whether AI description generation is enabled.
 * Enabled when VITE_GEMINI_API_KEY is set in the environment.
 */
export function isAiEnabled(): boolean {
    return !!process?.env?.VITE_GEMINI_API_KEY;
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
 * Minimum requirement: property_type AND at least ONE of
 * sale_type / price / city.
 */
export function getMinimumFieldsPresent(
    formData: Record<string, any>,
): FieldCheck {
    const missing: string[] = [];

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

    return { sufficient: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/** Map form keys to human-readable labels for the prompt. */
const FIELD_LABELS: Record<string, string> = {
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
- Do NOT invent features that are not listed — only embellish what is provided.
- Do NOT include a title/heading — return only the body description.
- Output plain text only (no markdown, no bullet points, no HTML).`;

/**
 * Call Gemini to generate a property listing description.
 *
 * @param formData – the current form values from PropertyCategoryForm
 * @returns The generated description text
 */
export async function generatePropertyDescription(
    formData: Record<string, any>,
): Promise<string> {
    const apiKey = process?.env?.VITE_GEMINI_API_KEY as string;
    if (!apiKey) {
        throw new Error("Gemini API key is not configured.");
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
        throw new Error("Gemini returned an empty response. Please try again.");
    }

    return text;
}
