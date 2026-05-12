/**
 * Custom hook for handling file uploads in location forms
 *
 * This hook processes form data with file uploads using MockFileService,
 * transforms the data to match LocationConfig interface, and submits
 * via useApiMutate.
 *
 * @note This hook currently uses MockFileService for development purposes.
 * For production file uploads, consider using the `useFileUpload` hook
 * from `@/Hooks/useFileUpload` which connects to the real upload API.
 *
 * @example
 * ```typescript
 * // Using with real file uploads:
 * import { useFileUpload } from '@/Hooks/useFileUpload';
 * const { uploadSingle } = useFileUpload();
 * // Replace mockUploadFile calls with uploadSingle
 * ```
 */

import { useState, useCallback } from "react";
import { UploadFile } from "antd";
import {
    mockUploadFile,
    mockUploadFiles,
    PlaceholderCategory,
} from "@/Services/MockFileService";
import type {
    LocationAttraction,
    LocationInfrastructure,
    LocationAirport,
    CreateProjectLocationInput,
} from "@/Types/developerProject";

// Form values structure (raw form data with file objects)
export interface LocationFormValues {
    name: string;
    description?: string;
    address_street?: string;
    address_city?: string;
    address_state?: string;
    address_country?: string;
    address_postalCode?: string;
    map_image?: UploadFile[];
    attractions?: AttractionFormValue[];
    infrastructure?: InfrastructureFormValue[];
    airports?: AirportFormValue[];
}

interface AttractionFormValue {
    name: string;
    content?: string[];
    primary_image?: UploadFile[];
    secondary_image?: UploadFile[];
}

interface InfrastructureFormValue {
    name: string;
    travelTimeInMin?: number;
    image?: UploadFile[];
}

interface AirportFormValue {
    name: string;
    travelTimeInMin?: number;
    image?: UploadFile[];
}

// Result of file extraction
interface ExtractedFile {
    file: File;
    category: PlaceholderCategory;
    path: string; // dot notation path to set the URL
}

/**
 * Extract File from UploadFile
 */
const getFileFromUpload = (uploadFile: UploadFile): File | null => {
    if (uploadFile.originFileObj) {
        return uploadFile.originFileObj;
    }
    return null;
};

/**
 * Extract all files from form values
 */
const extractFilesFromForm = (values: LocationFormValues): ExtractedFile[] => {
    const files: ExtractedFile[] = [];

    // Map image
    if (values.map_image?.[0]) {
        const file = getFileFromUpload(values.map_image[0]);
        if (file) {
            files.push({ file, category: "map", path: "map_url" });
        }
    }

    // Attractions images
    values.attractions?.forEach((attraction, index) => {
        if (attraction.primary_image?.[0]) {
            const file = getFileFromUpload(attraction.primary_image[0]);
            if (file) {
                files.push({
                    file,
                    category: "attraction",
                    path: `attractions.${index}.images.primary`,
                });
            }
        }
        if (attraction.secondary_image?.[0]) {
            const file = getFileFromUpload(attraction.secondary_image[0]);
            if (file) {
                files.push({
                    file,
                    category: "attraction",
                    path: `attractions.${index}.images.secondary`,
                });
            }
        }
    });

    // Infrastructure images
    values.infrastructure?.forEach((infra, index) => {
        if (infra.image?.[0]) {
            const file = getFileFromUpload(infra.image[0]);
            if (file) {
                files.push({
                    file,
                    category: "infrastructure",
                    path: `infrastructure.${index}.image`,
                });
            }
        }
    });

    // Airport images
    values.airports?.forEach((airport, index) => {
        if (airport.image?.[0]) {
            const file = getFileFromUpload(airport.image[0]);
            if (file) {
                files.push({
                    file,
                    category: "airport",
                    path: `airports.${index}.image`,
                });
            }
        }
    });

    return files;
};

/**
 * Set value at dot notation path
 */
const setAtPath = (obj: any, path: string, value: any): void => {
    const parts = path.split(".");
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const nextPart = parts[i + 1];
        const isNextIndex = !isNaN(Number(nextPart));

        if (!(part in current)) {
            current[part] = isNextIndex ? [] : {};
        }
        current = current[part];
    }
    current[parts[parts.length - 1]] = value;
};

/**
 * Transform form values to API payload
 */
export const transformFormToPayload = async (
    values: LocationFormValues,
    existingLocation?: {
        map_url?: string | null;
        image_url?: string | null;
        attractions?: any[];
        infrastructure?: any[];
        airports?: any[];
    } | null,
): Promise<CreateProjectLocationInput> => {
    // Start building the payload
    const payload: CreateProjectLocationInput = {
        name: values.name,
        description: values.description,
        address: {
            street: values.address_street,
            city: values.address_city,
            state: values.address_state,
            country: values.address_country,
            postalCode: values.address_postalCode,
        },
        map_url: existingLocation?.map_url || undefined,
        image_url: existingLocation?.image_url || undefined,
        attractions: (values.attractions || []).map((a, index) => ({
            name: a.name,
            content: Array.isArray(a.content) ? a.content : [a.content || ""],
            images: {
                primary:
                    existingLocation?.attractions?.[index]?.images?.primary ||
                    "",
                secondary:
                    existingLocation?.attractions?.[index]?.images?.secondary ||
                    "",
            },
        })),
        infrastructure: (values.infrastructure || []).map((i, index) => ({
            name: i.name,
            travelTimeInMin: i.travelTimeInMin || 0,
            image: existingLocation?.infrastructure?.[index]?.image || "",
        })),
        airports: (values.airports || []).map((a, index) => ({
            name: a.name,
            travelTimeInMin: a.travelTimeInMin || 0,
            image: existingLocation?.airports?.[index]?.image || "",
        })),
    };

    // Extract and upload files
    const extractedFiles = extractFilesFromForm(values);

    // Upload all files in parallel
    const uploadResults = await Promise.all(
        extractedFiles.map(async ({ file, category, path }) => {
            const url = await mockUploadFile(file, category);
            return { path, url };
        }),
    );

    // Set uploaded URLs in payload
    uploadResults.forEach(({ path, url }) => {
        setAtPath(payload, path, url);
    });

    return payload;
};

/**
 * Hook state and methods
 */
export interface UseLocationFormUploadReturn {
    isUploading: boolean;
    uploadProgress: number;
    processAndSubmit: (
        values: LocationFormValues,
        existingLocation?: any,
    ) => Promise<CreateProjectLocationInput>;
}

/**
 * Custom hook for location form with file uploads
 */
export const useLocationFormUpload = (): UseLocationFormUploadReturn => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const processAndSubmit = useCallback(
        async (
            values: LocationFormValues,
            existingLocation?: any,
        ): Promise<CreateProjectLocationInput> => {
            setIsUploading(true);
            setUploadProgress(0);

            try {
                // Simulate progress
                const progressInterval = setInterval(() => {
                    setUploadProgress((prev) => Math.min(prev + 10, 90));
                }, 100);

                const payload = await transformFormToPayload(
                    values,
                    existingLocation,
                );

                clearInterval(progressInterval);
                setUploadProgress(100);

                return payload;
            } finally {
                setTimeout(() => {
                    setIsUploading(false);
                    setUploadProgress(0);
                }, 300);
            }
        },
        [],
    );

    return {
        isUploading,
        uploadProgress,
        processAndSubmit,
    };
};

export default useLocationFormUpload;
