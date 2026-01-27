<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Illuminate\Support\Facades\Log;

class ParsePatchMultipart
{
    /**
     * Handle an incoming request.
     * 
     * PHP doesn't automatically parse multipart/form-data for PATCH/PUT requests.
     * This middleware manually parses the request body and populates the request
     * with files and form data, making PATCH requests behave like POST requests.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        // Only process PATCH/PUT requests with multipart/form-data
        if (!in_array($request->method(), ['PATCH', 'PUT']) || 
            !str_contains($request->header('Content-Type', ''), 'multipart/form-data')) {
            return $next($request);
        }

        // If request already has parsed data, skip (PHP already parsed it or middleware already ran)
        if (!empty($request->all()) || !empty($request->allFiles())) {
            return $next($request);
        }

        try {
            $this->parseMultipartData($request);
        } catch (\Exception $e) {
            Log::error('ParsePatchMultipart: Failed to parse multipart data', [
                'error' => $e->getMessage(),
            ]);
            // Continue anyway - let Laravel handle it
        }

        return $next($request);
    }

    /**
     * Parse multipart/form-data from request body
     * 
     * @return bool True if data was parsed, false otherwise
     */
    protected function parseMultipartData(Request $request): bool
    {
        $contentType = $request->header('Content-Type', '');
        
        // Extract boundary from Content-Type header
        if (!preg_match('/boundary=(.*)$/', $contentType, $matches)) {
            return false;
        }

        $boundary = trim($matches[1], '"');
        
        // Get raw request content - Laravel caches this, so it's safe to call multiple times
        $rawInput = $request->getContent();
        
        // Fallback to php://input if getContent() returns empty
        if (empty($rawInput)) {
            $rawInput = @file_get_contents('php://input');
        }

        if (empty($rawInput)) {
            return false;
        }

        // Split by boundary - escape boundary to prevent regex injection
        $escapedBoundary = preg_quote($boundary, '/');
        $parts = preg_split("/-+{$escapedBoundary}/", $rawInput);
        
        // Remove first and last empty parts
        if (count($parts) < 2) {
            return false;
        }
        
        array_shift($parts);
        array_pop($parts);

        $parsedData = [];
        $parsedFiles = [];

        foreach ($parts as $part) {
            // Split headers and body
            if (strpos($part, "\r\n\r\n") === false) {
                continue;
            }

            list($headers, $body) = explode("\r\n\r\n", $part, 2);
            $body = rtrim($body, "\r\n");

            // Parse headers
            $headers = $this->parseHeaders($headers);
            
            if (!isset($headers['content-disposition'])) {
                continue;
            }

            // Extract field name from Content-Disposition
            if (!preg_match('/name="([^"]+)"/', $headers['content-disposition'], $nameMatches)) {
                continue;
            }

            $fieldName = $nameMatches[1];
            
            // Check if this is a file upload
            $isFile = false;
            $filename = '';
            
            if (preg_match('/filename="([^"]*)"/', $headers['content-disposition'], $fileMatches)) {
                $filename = $fileMatches[1];
                $isFile = !empty($filename);
            } elseif (preg_match('/filename=([^\s;]+)/', $headers['content-disposition'], $fileMatches)) {
                $filename = trim($fileMatches[1], '"');
                $isFile = !empty($filename);
            }
            
            if ($isFile) {
                // This is a file upload
                $mimeType = $headers['content-type'] ?? 'application/octet-stream';
                
                // Create temporary file
                $tempFile = tempnam(sys_get_temp_dir(), 'laravel_upload_');
                file_put_contents($tempFile, $body);
                
                // Create UploadedFile instance
                $uploadedFile = new UploadedFile(
                    $tempFile,
                    $filename,
                    $mimeType,
                    null,
                    true // test mode
                );

                // Handle nested field names like "data[fieldName]"
                $this->setNestedValue($parsedFiles, $fieldName, $uploadedFile);
            } else {
                // Regular form field
                $this->setNestedValue($parsedData, $fieldName, $body);
            }
        }

        // Merge parsed data into request
        if (!empty($parsedData)) {
            $request->merge($parsedData);
        }

        // Merge parsed files into request
        // Laravel's file bag uses dot notation, so we need to flatten nested arrays
        if (!empty($parsedFiles)) {
            $this->mergeFilesIntoRequest($request, $parsedFiles);
        }

        return !empty($parsedData) || !empty($parsedFiles);
    }

    /**
     * Parse headers from multipart part
     */
    protected function parseHeaders($headerString)
    {
        $headers = [];
        $lines = explode("\r\n", $headerString);
        
        foreach ($lines as $line) {
            if (strpos($line, ':') === false) {
                continue;
            }
            
            list($name, $value) = explode(':', $line, 2);
            $name = strtolower(trim($name));
            $value = trim($value);
            
            $headers[$name] = $value;
        }
        
        return $headers;
    }

    /**
     * Set nested value in array (handles "data[fieldName]" notation)
     */
    protected function setNestedValue(array &$array, string $key, $value)
    {
        // Handle array notation like "data[fieldName]"
        if (preg_match('/^([^\[]+)(\[.*\])$/', $key, $matches)) {
            $baseKey = $matches[1];
            $nestedPath = $matches[2];
            
            // Extract nested keys from [key1][key2] format
            preg_match_all('/\[([^\]]+)\]/', $nestedPath, $nestedMatches);
            $nestedKeys = $nestedMatches[1];
            
            // Build nested array structure
            if (!isset($array[$baseKey])) {
                $array[$baseKey] = [];
            }
            $current = &$array[$baseKey];
            foreach ($nestedKeys as $nestedKey) {
                if (!isset($current[$nestedKey]) || !is_array($current[$nestedKey])) {
                    $current[$nestedKey] = [];
                }
                $current = &$current[$nestedKey];
            }
            $current = $value;
        } else {
            // Simple key
            $array[$key] = $value;
        }
    }

    /**
     * Merge files into request using Laravel's file bag
     * Handles both flat and nested file structures
     */
    protected function mergeFilesIntoRequest(Request $request, array $files)
    {
        foreach ($files as $key => $file) {
            if (is_array($file)) {
                // Nested structure - use dot notation for Laravel
                $this->mergeNestedFiles($request, $key, $file);
            } else {
                // Flat structure
                $request->files->set($key, $file);
            }
        }
    }

    /**
     * Recursively merge nested file structures
     */
    protected function mergeNestedFiles(Request $request, string $prefix, $files)
    {
        foreach ($files as $key => $value) {
            $fullKey = $prefix . '.' . $key;
            
            if ($value instanceof UploadedFile) {
                $request->files->set($fullKey, $value);
            } elseif (is_array($value)) {
                $this->mergeNestedFiles($request, $fullKey, $value);
            }
        }
    }
}
