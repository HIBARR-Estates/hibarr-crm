<?php

namespace App\Email\Files;

use App\Services\FileStorageService;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use SensitiveParameter;
use Throwable;

/**
 * Puts email attachments on, and reads them back from, the CRM's existing
 * file gateway — always under the email prefix, so they sit apart from lead
 * and deal files.
 */
class EmailFileStorage
{
    public function __construct(private readonly FileStorageService $gateway) {}

    /**
     * @return array{key: string, url: string}
     *
     * @throws RuntimeException when the gateway does not take the file.
     */
    public function put(#[SensitiveParameter] string $bytes, string $filename): array
    {
        $path = tempnam(sys_get_temp_dir(), 'email-file-');

        if ($path === false || file_put_contents($path, $bytes) === false) {
            throw new RuntimeException('Could not buffer the email file for upload.');
        }

        try {
            return $this->putFromPath($path, $filename);
        } finally {
            @unlink($path);
        }
    }

    /**
     * @return array{key: string, url: string}
     *
     * @throws RuntimeException when the gateway does not take the file.
     */
    public function putFromPath(string $path, string $filename): array
    {
        $stored = $this->gateway->uploadFromPath($path, $filename, (string) config('email.files.prefix', 'email-attachments'));

        $key = (string) ($stored['objectPath'] ?? '');
        $url = (string) ($stored['downloadUrl'] ?? '');

        if ($key === '' || $url === '') {
            throw new RuntimeException('The file gateway returned no location for the email file.');
        }

        return ['key' => $key, 'url' => $url];
    }

    /** The stored bytes, fetched server-side. Null when they cannot be read. */
    public function get(string $url): ?string
    {
        try {
            $response = Http::timeout((int) config('email.files.timeout', 30))->get($url);
        } catch (Throwable) {
            return null;
        }

        return $response->successful() ? $response->body() : null;
    }
}
