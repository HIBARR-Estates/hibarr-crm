<?php

return [

    /*
    |--------------------------------------------------------------------------
    | External File Storage Service Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for the external file upload/storage API service.
    | This is used by FileStorageService to upload files to the external
    | storage provider (e.g., MinIO via the upload gateway).
    |
    */

    'base_url' => env('FILE_UPLOAD_BASE_URL', 'https://develop-api.hibarr.org/v1'),

    'api_key' => env('FILE_UPLOAD_API_KEY', ''),

    /*
    |--------------------------------------------------------------------------
    | Default Target Folder
    |--------------------------------------------------------------------------
    |
    | The default folder/prefix used when uploading files to the external
    | storage service. Can be overridden per-upload call.
    |
    */

    'default_target_folder' => env('FILE_UPLOAD_TARGET_FOLDER', 'backend-uploads'),

    /*
    |--------------------------------------------------------------------------
    | Timeout
    |--------------------------------------------------------------------------
    |
    | Request timeout in seconds for upload/delete operations.
    |
    */

    'timeout' => env('FILE_UPLOAD_TIMEOUT', 120),

    /*
    |--------------------------------------------------------------------------
    | Retry Configuration
    |--------------------------------------------------------------------------
    |
    | How many times to retry a failed upload before giving up,
    | and the base delay (in milliseconds) between retries.
    | Retries use exponential backoff: base_delay * 2^attempt.
    |
    */

    'retry_count' => env('FILE_UPLOAD_RETRY_COUNT', 2),

    'retry_base_delay_ms' => env('FILE_UPLOAD_RETRY_BASE_DELAY_MS', 1000),

];
