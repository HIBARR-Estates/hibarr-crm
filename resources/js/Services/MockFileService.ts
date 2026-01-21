/**
 * Mock File Service
 *
 * TEMPORARY: This service provides mock implementations for file uploads.
 * It returns placeholder URLs for development purposes until the real
 * file storage service (e.g., Minio/S3) is implemented.
 *
 * OUT OF SCOPE: Real file storage implementation is deferred.
 * This file should be replaced with actual file upload logic later.
 */

// Placeholder image URLs for different use cases
const PLACEHOLDER_IMAGES = {
    logo: "https://via.placeholder.com/300x100/1a1a2e/ffffff?text=Logo",
    property:
        "https://via.placeholder.com/800x600/2d3748/ffffff?text=Property+Image",
    facility: "https://via.placeholder.com/200x200/4a5568/ffffff?text=Facility",
    map: "https://via.placeholder.com/800x400/38a169/ffffff?text=Map+Image",
    attraction:
        "https://via.placeholder.com/600x400/3182ce/ffffff?text=Attraction",
    infrastructure:
        "https://via.placeholder.com/400x300/805ad5/ffffff?text=Infrastructure",
    airport: "https://via.placeholder.com/400x300/d69e2e/ffffff?text=Airport",
    floorPlan:
        "https://via.placeholder.com/800x600/718096/ffffff?text=Floor+Plan",
    generic: "https://via.placeholder.com/600x400/a0aec0/ffffff?text=Image",
};

export type PlaceholderCategory = keyof typeof PLACEHOLDER_IMAGES;

/**
 * Simulates network delay for realistic behavior
 */
const simulateDelay = (ms: number = 500): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Generate a unique mock URL with timestamp to avoid caching issues
 */
const generateMockUrl = (category: PlaceholderCategory = "generic"): string => {
    const baseUrl = PLACEHOLDER_IMAGES[category] || PLACEHOLDER_IMAGES.generic;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${baseUrl}&t=${timestamp}-${random}`;
};

/**
 * Mock single file upload
 *
 * Simulates uploading a file and returns a placeholder URL.
 * In production, this would upload to Minio/S3 and return the real URL.
 *
 * @param file - The file to "upload"
 * @param category - Category for selecting appropriate placeholder
 * @returns Promise resolving to the mock URL
 */
export const mockUploadFile = async (
    file: File,
    category: PlaceholderCategory = "generic",
): Promise<string> => {
    // Simulate network delay (300-800ms random)
    await simulateDelay(300 + Math.random() * 500);

    // Log the file that would be uploaded (for debugging)
    console.log(
        `[MockFileService] Would upload file: ${file.name} (${file.size} bytes, ${file.type})`,
    );

    // Return a placeholder URL
    return generateMockUrl(category);
};

/**
 * Mock multiple file upload
 *
 * Simulates uploading multiple files and returns an array of placeholder URLs.
 *
 * @param files - Array of files to "upload"
 * @param category - Category for selecting appropriate placeholders
 * @returns Promise resolving to array of mock URLs
 */
export const mockUploadFiles = async (
    files: File[],
    category: PlaceholderCategory = "generic",
): Promise<string[]> => {
    // Process files in parallel but with staggered delays
    const uploadPromises = files.map((file, index) =>
        simulateDelay(index * 100).then(() => mockUploadFile(file, category)),
    );

    return Promise.all(uploadPromises);
};

/**
 * Mock file deletion
 *
 * Simulates deleting a file from storage.
 *
 * @param url - The URL of the file to "delete"
 * @returns Promise resolving to success status
 */
export const mockDeleteFile = async (url: string): Promise<boolean> => {
    await simulateDelay(200);
    console.log(`[MockFileService] Would delete file: ${url}`);
    return true;
};

/**
 * Validate file before upload
 *
 * Checks file type and size constraints.
 * This validation logic will be reused when real uploads are implemented.
 *
 * @param file - The file to validate
 * @param options - Validation options
 * @returns Validation result
 */
export const validateFile = (
    file: File,
    options: {
        maxSizeMB?: number;
        allowedTypes?: string[];
    } = {},
): { valid: boolean; error?: string } => {
    const {
        maxSizeMB = 10,
        allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"],
    } = options;

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        return {
            valid: false,
            error: `File size exceeds ${maxSizeMB}MB limit`,
        };
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(", ")}`,
        };
    }

    return { valid: true };
};

/**
 * Mock upload with validation
 *
 * Validates the file before "uploading".
 *
 * @param file - The file to upload
 * @param category - Category for placeholder
 * @param validationOptions - Validation options
 * @returns Promise resolving to upload result
 */
export const mockUploadFileWithValidation = async (
    file: File,
    category: PlaceholderCategory = "generic",
    validationOptions?: Parameters<typeof validateFile>[1],
): Promise<{ success: boolean; url?: string; error?: string }> => {
    const validation = validateFile(file, validationOptions);

    if (!validation.valid) {
        return {
            success: false,
            error: validation.error,
        };
    }

    try {
        const url = await mockUploadFile(file, category);
        return {
            success: true,
            url,
        };
    } catch (error) {
        return {
            success: false,
            error: "Upload failed",
        };
    }
};

/**
 * Get a random placeholder URL for testing
 * Useful for seeding mock data
 */
export const getRandomPlaceholder = (
    category?: PlaceholderCategory,
): string => {
    if (category) {
        return generateMockUrl(category);
    }

    const categories = Object.keys(PLACEHOLDER_IMAGES) as PlaceholderCategory[];
    const randomCategory =
        categories[Math.floor(Math.random() * categories.length)];
    return generateMockUrl(randomCategory);
};

/**
 * Generate multiple random placeholders
 */
export const getRandomPlaceholders = (
    count: number,
    category?: PlaceholderCategory,
): string[] => {
    return Array.from({ length: count }, () => getRandomPlaceholder(category));
};

// Export placeholder URLs for direct use if needed
export { PLACEHOLDER_IMAGES };

// Default export for convenience
export default {
    mockUploadFile,
    mockUploadFiles,
    mockDeleteFile,
    validateFile,
    mockUploadFileWithValidation,
    getRandomPlaceholder,
    getRandomPlaceholders,
    PLACEHOLDER_IMAGES,
};
