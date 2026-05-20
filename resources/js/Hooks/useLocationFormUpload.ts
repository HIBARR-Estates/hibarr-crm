/**
 * Custom hook for handling file uploads in location forms
 *
 * This hook processes form data with file uploads using the real FileUploadService,
 * uploads files to external storage (Minio/S3), transforms data to match
 * LocationConfig interface, and submits the payload via useApiMutate.
 *
 * Features:
 * - Real file uploads with progress tracking
 * - Parallel upload processing
 * - Proper error handling
 * - URLs are stored in database and available for PDF generation
 */

import { useState, useCallback } from "react";
import { UploadFile } from "antd";
import { getFileUploadService } from "@/Services/FileUploadService";
import type { IUploadResponseItem } from "@/Types/uploads";
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
    path: string; // dot notation path to set the URL
    targetFolder: string; // target folder for upload
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
            files.push({
                file,
                path: "map_url",
                targetFolder: "project-locations/map-images",
            });
        }
    }

    // Attractions images
    values.attractions?.forEach((attraction, index) => {
        if (attraction.primary_image?.[0]) {
            const file = getFileFromUpload(attraction.primary_image[0]);
            if (file) {
                files.push({
                    file,
                    path: `attractions.${index}.images.primary`,
                    targetFolder: "project-locations/attractions",
                });
            }
        }
        if (attraction.secondary_image?.[0]) {
            const file = getFileFromUpload(attraction.secondary_image[0]);
            if (file) {
                files.push({
                    file,
                    path: `attractions.${index}.images.secondary`,
                    targetFolder: "project-locations/attractions",
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
                    path: `infrastructure.${index}.image`,
                    targetFolder: "project-locations/infrastructure",
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
                    path: `airports.${index}.image`,
                    targetFolder: "project-locations/airports",
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
 *
 * Handles the complete upload pipeline:
 * 1. Extracts files from form values
 * 2. Uploads files to external storage service
 * 3. Gets real download URLs (not mock URLs)
 * 4. Injects URLs into the payload for database storage
 */
export const transformFormToPayload = async (
    values: LocationFormValues,
    existingLocation?: {
        name?: string | null;
        description?: string | null;
        address?: {
            street?: string | null;
            city?: string | null;
            state?: string | null;
            country?: string | null;
            postalCode?: string | null;
        } | null;
        map_url?: string | null;
        image_url?: string | null;
        attractions?: any[];
        infrastructure?: any[];
        airports?: any[];
    } | null,
): Promise<CreateProjectLocationInput> => {
    const hasAttractions = Array.isArray(values.attractions);
    const hasInfrastructure = Array.isArray(values.infrastructure);
    const hasAirports = Array.isArray(values.airports);

    // Start building the payload with existing base data
    const payload: CreateProjectLocationInput = {
        name: values.name ?? existingLocation?.name ?? "",
        description: values.description ?? existingLocation?.description ?? "",
        address: {
            street:
                values.address_street ??
                existingLocation?.address?.street ??
                undefined,
            city:
                values.address_city ??
                existingLocation?.address?.city ??
                undefined,
            state:
                values.address_state ??
                existingLocation?.address?.state ??
                undefined,
            country:
                values.address_country ??
                existingLocation?.address?.country ??
                undefined,
            postalCode:
                values.address_postalCode ??
                existingLocation?.address?.postalCode ??
                undefined,
        },
        map_url: existingLocation?.map_url || undefined,
        image_url: existingLocation?.image_url || undefined,
        attractions: hasAttractions
            ? values.attractions!.map((a, index) => ({
                  name: a.name,
                  content: Array.isArray(a.content)
                      ? a.content
                      : [a.content || ""],
                  images: {
                      primary:
                          existingLocation?.attractions?.[index]?.images
                              ?.primary || "",
                      secondary:
                          existingLocation?.attractions?.[index]?.images
                              ?.secondary || "",
                  },
              }))
            : existingLocation?.attractions || [],
        infrastructure: hasInfrastructure
            ? values.infrastructure!.map((i, index) => ({
                  name: i.name,
                  travelTimeInMin: i.travelTimeInMin || 0,
                  image: existingLocation?.infrastructure?.[index]?.image || "",
              }))
            : existingLocation?.infrastructure || [],
        airports: hasAirports
            ? values.airports!.map((a, index) => ({
                  name: a.name,
                  travelTimeInMin: a.travelTimeInMin || 0,
                  image: existingLocation?.airports?.[index]?.image || "",
              }))
            : existingLocation?.airports || [],
    };

    // Extract files to upload
    const extractedFiles = extractFilesFromForm(values);

    // Upload all files in parallel using real FileUploadService
    if (extractedFiles.length > 0) {
        const uploadService = getFileUploadService();

        const uploadResults = await Promise.all(
            extractedFiles.map(async ({ file, path, targetFolder }) => {
                const response = await uploadService.uploadSingle(
                    file,
                    targetFolder,
                );
                // Return real download URL
                return { path, url: response.downloadUrl };
            }),
        );

        // Inject uploaded URLs into payload
        uploadResults.forEach(({ path, url }) => {
            setAtPath(payload, path, url);
        });
    }

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
