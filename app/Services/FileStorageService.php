<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * FileStorageService
 *
 * PHP service that mirrors the frontend FileUploadService.
 * Uploads files to the external storage API (e.g., staging-api.hibarr.org/v1/upload)
 * and handles deletion of remotely stored files.
 *
 * Used by:
 * - CustomFieldsTrait for file-type custom field uploads
 * - LeadFileController for deal file uploads (when proxied through backend)
 * - Future migration workers to re-upload existing local files
 */
class FileStorageService
{
    protected string $baseUrl;
    protected string $apiKey;
    protected string $defaultTargetFolder;
    protected int $timeout;
    protected int $retryCount;
    protected int $retryBaseDelayMs;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('file_storage.base_url', 'https://staging-api.hibarr.org/v1'), '/');
        $this->apiKey = config('file_storage.api_key', '');
        $this->defaultTargetFolder = config('file_storage.default_target_folder', 'backend-uploads');
        $this->timeout = config('file_storage.timeout', 120);
        $this->retryCount = config('file_storage.retry_count', 2);
        $this->retryBaseDelayMs = config('file_storage.retry_base_delay_ms', 1000);
    }

    // ========================================================================
    // Upload Operations
    // ========================================================================

    /**
     * Upload a single file to the external storage API.
     *
     * @param  UploadedFile  $file          The file to upload
     * @param  string|null   $targetFolder  Target folder/prefix (defaults to config value)
     * @return array{objectPath: string, originalName: string, downloadUrl: string}
     *
     * @throws \RuntimeException  When upload fails after all retries
     */
    public function upload(UploadedFile $file, ?string $targetFolder = null): array
    {
        $folder = $targetFolder ?? $this->defaultTargetFolder;

        return $this->withRetry(function () use ($file, $folder) {
            $response = Http::timeout($this->timeout)
                ->withHeaders([
                    'X-Api-Key' => $this->apiKey,
                ])
                ->attach(
                    'file',
                    file_get_contents($file->getRealPath()),
                    $file->getClientOriginalName()
                )
                ->post("{$this->baseUrl}/upload", [
                    'targetFolder' => $folder,
                ]);

            if (!$response->successful()) {
                throw new \RuntimeException(
                    "File upload failed with status {$response->status()}: {$response->body()}"
                );
            }

            $data = $response->json('data');

            if (empty($data) || !is_array($data) || count($data) === 0) {
                throw new \RuntimeException('Upload succeeded but no data returned');
            }

            return $data[0];
        }, $file->getClientOriginalName());
    }

    /**
     * Upload a file from a local path (not an UploadedFile instance).
     *
     * Useful for migration scripts that re-upload existing files from local storage.
     *
     * @param  string       $filePath       Absolute path to the file on disk
     * @param  string       $originalName   The original filename to use
     * @param  string|null  $targetFolder   Target folder/prefix
     * @return array{objectPath: string, originalName: string, downloadUrl: string}
     *
     * @throws \RuntimeException
     */
    public function uploadFromPath(string $filePath, string $originalName, ?string $targetFolder = null): array
    {
        $folder = $targetFolder ?? $this->defaultTargetFolder;

        return $this->withRetry(function () use ($filePath, $originalName, $folder) {
            $response = Http::timeout($this->timeout)
                ->withHeaders([
                    'X-Api-Key' => $this->apiKey,
                ])
                ->attach(
                    'file',
                    file_get_contents($filePath),
                    $originalName
                )
                ->post("{$this->baseUrl}/upload", [
                    'targetFolder' => $folder,
                ]);

            if (!$response->successful()) {
                throw new \RuntimeException(
                    "File upload failed with status {$response->status()}: {$response->body()}"
                );
            }

            $data = $response->json('data');

            if (empty($data) || !is_array($data) || count($data) === 0) {
                throw new \RuntimeException('Upload succeeded but no data returned');
            }

            return $data[0];
        }, $originalName);
    }

    /**
     * Upload multiple files to the external storage API.
     *
     * @param  UploadedFile[]  $files         Array of files to upload
     * @param  string|null     $targetFolder  Target folder/prefix
     * @return array<int, array{objectPath: string, originalName: string, downloadUrl: string}>
     *
     * @throws \RuntimeException  When all uploads fail
     */
    public function uploadMultiple(array $files, ?string $targetFolder = null): array
    {
        $results = [];
        $errors = [];

        foreach ($files as $file) {
            try {
                $results[] = $this->upload($file, $targetFolder);
            } catch (\Exception $e) {
                Log::warning('FileStorageService: Single file upload failed in batch', [
                    'file' => $file->getClientOriginalName(),
                    'error' => $e->getMessage(),
                ]);
                $errors[] = [
                    'file' => $file->getClientOriginalName(),
                    'error' => $e->getMessage(),
                ];
            }
        }

        if (empty($results) && !empty($errors)) {
            throw new \RuntimeException(
                'All file uploads failed. First error: ' . $errors[0]['error']
            );
        }

        return $results;
    }

    // ========================================================================
    // Delete Operations
    // ========================================================================

    /**
     * Delete a single file from external storage.
     *
     * @param  string  $objectPath  The object path returned from upload (e.g., "backend-uploads/123-abc-file.pdf")
     * @return array{objectPath: string}
     *
     * @throws \RuntimeException  When deletion fails
     */
    public function delete(string $objectPath): array
    {
        try {
            $response = Http::timeout($this->timeout)
                ->withHeaders([
                    'X-Api-Key' => $this->apiKey,
                ])
                ->delete("{$this->baseUrl}/upload", [
                    'objectPath' => $objectPath,
                ]);

            if (!$response->successful()) {
                throw new \RuntimeException(
                    "File deletion failed with status {$response->status()}: {$response->body()}"
                );
            }

            return $response->json('data') ?? ['objectPath' => $objectPath];
        } catch (\Exception $e) {
            Log::error('FileStorageService: Failed to delete file', [
                'objectPath' => $objectPath,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Delete multiple files from external storage.
     *
     * @param  string[]  $objectPaths  Array of object paths to delete
     * @return array<int, array{objectPath: string}>
     */
    public function deleteMultiple(array $objectPaths): array
    {
        $results = [];

        foreach ($objectPaths as $objectPath) {
            try {
                $results[] = $this->delete($objectPath);
            } catch (\Exception $e) {
                Log::warning('FileStorageService: Single file deletion failed in batch', [
                    'objectPath' => $objectPath,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $results;
    }

    // ========================================================================
    // Utility
    // ========================================================================

    /**
     * Check if a stored value is an external URL (as opposed to a local filename).
     *
     * @param  string|null  $value
     * @return bool
     */
    public static function isExternalUrl(?string $value): bool
    {
        if (empty($value)) {
            return false;
        }

        return str_starts_with($value, 'http://') || str_starts_with($value, 'https://');
    }

    /**
     * Extract the object path from an external download URL.
     *
     * The external API returns URLs like:
     *   https://minio.hibarr.org/backend-uploads/backend-uploads/1769682430742-abc-file.pdf
     *
     * The objectPath is:
     *   backend-uploads/1769682430742-abc-file.pdf
     *
     * @param  string  $downloadUrl
     * @return string|null  The object path, or null if it can't be parsed
     */
    public static function extractObjectPathFromUrl(string $downloadUrl): ?string
    {
        // Try to extract from known URL patterns
        $parsed = parse_url($downloadUrl);
        if (!$parsed || empty($parsed['path'])) {
            return null;
        }

        // Remove leading slash
        $path = ltrim($parsed['path'], '/');

        // The MinIO URL structure duplicates the bucket name in the path
        // e.g., /backend-uploads/backend-uploads/timestamp-file.pdf
        // We want: backend-uploads/timestamp-file.pdf
        $segments = explode('/', $path);
        if (count($segments) >= 3 && $segments[0] === $segments[1]) {
            // Remove the duplicated first segment (bucket name)
            array_shift($segments);
        }

        return implode('/', $segments);
    }

    // ========================================================================
    // Retry Logic
    // ========================================================================

    /**
     * Execute a callback with retry logic and exponential backoff.
     *
     * @param  callable  $fn        The operation to retry
     * @param  string    $fileName  For logging purposes
     * @return mixed
     *
     * @throws \RuntimeException
     */
    protected function withRetry(callable $fn, string $fileName)
    {
        $lastException = null;

        for ($attempt = 0; $attempt <= $this->retryCount; $attempt++) {
            try {
                return $fn();
            } catch (\Exception $e) {
                $lastException = $e;

                if ($attempt < $this->retryCount) {
                    $delay = $this->getBackoffDelay($attempt);

                    Log::warning("FileStorageService: Upload attempt {$attempt} failed for '{$fileName}', retrying in {$delay}ms", [
                        'error' => $e->getMessage(),
                        'attempt' => $attempt + 1,
                        'maxRetries' => $this->retryCount,
                    ]);

                    usleep($delay * 1000); // Convert ms to microseconds
                }
            }
        }

        Log::error("FileStorageService: All upload attempts failed for '{$fileName}'", [
            'error' => $lastException?->getMessage(),
            'totalAttempts' => $this->retryCount + 1,
        ]);

        throw new \RuntimeException(
            "File upload failed after " . ($this->retryCount + 1) . " attempts for '{$fileName}': " . $lastException?->getMessage(),
            0,
            $lastException
        );
    }

    /**
     * Calculate exponential backoff delay with jitter.
     *
     * @param  int  $attempt  Zero-indexed attempt number
     * @return int  Delay in milliseconds
     */
    protected function getBackoffDelay(int $attempt): int
    {
        $exponentialDelay = $this->retryBaseDelayMs * pow(2, $attempt);
        $jitter = rand(0, 500);

        return min($exponentialDelay + $jitter, 30000); // Cap at 30 seconds
    }
}
