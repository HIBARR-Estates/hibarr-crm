/// <reference types="vite/client" />

/**
 * Vite Environment Variables Type Definitions
 *
 * Provides TypeScript IntelliSense for Vite environment variables.
 * Add new VITE_* variables here for proper type checking.
 */

interface ImportMetaEnv {
    /** Base URL for the file upload service */
    readonly VITE_FILE_UPLOAD_BASE_URL?: string;
    /** API key for the file upload service */
    readonly VITE_FILE_UPLOAD_API_KEY?: string;
    /** Pusher App Key */
    readonly VITE_PUSHER_APP_KEY?: string;
    /** Pusher App Cluster */
    readonly VITE_PUSHER_APP_CLUSTER?: string;
    /** Base URL of the application */
    readonly VITE_APP_URL?: string;
    // Add more environment variables as needed
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
