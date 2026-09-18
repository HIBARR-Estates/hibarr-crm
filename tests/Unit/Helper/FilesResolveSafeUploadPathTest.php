<?php

namespace Tests\Unit\Helper;

use App\Helper\Files;
use Illuminate\Support\Facades\File as FileFacade;
use Tests\TestCase;

class FilesResolveSafeUploadPathTest extends TestCase
{
    private string $importDir;

    protected function setUp(): void
    {
        parent::setUp();

        $this->importDir = public_path(Files::UPLOAD_FOLDER . DIRECTORY_SEPARATOR . Files::IMPORT_FOLDER);

        if (!FileFacade::isDirectory($this->importDir)) {
            FileFacade::makeDirectory($this->importDir, 0755, true);
        }
    }

    public function test_strict_mode_accepts_a_generated_filename_shape(): void
    {
        $filename = md5('example') . '.csv';

        $path = Files::resolveSafeUploadPath($filename, Files::IMPORT_FOLDER, true);

        $this->assertSame(
            rtrim($this->importDir, '/\\') . DIRECTORY_SEPARATOR . $filename,
            $path
        );
    }

    public function test_it_rejects_directory_traversal_payloads(): void
    {
        $payloads = [
            '../../../.env',
            '..\\..\\.env',
            '/etc/passwd',
            'sub/dir/file.csv',
            'sub\\dir\\file.csv',
        ];

        foreach ($payloads as $payload) {
            try {
                Files::resolveSafeUploadPath($payload, Files::IMPORT_FOLDER, true);
                $this->fail("Expected InvalidArgumentException for payload [{$payload}]");
            } catch (\InvalidArgumentException $e) {
                $this->assertTrue(true);
            }
        }
    }

    public function test_it_rejects_null_or_empty_filename(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        Files::resolveSafeUploadPath('', Files::IMPORT_FOLDER, true);
    }

    public function test_strict_mode_rejects_a_non_generated_filename_shape(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        Files::resolveSafeUploadPath('hello.csv', Files::IMPORT_FOLDER, true);
    }

    public function test_non_strict_mode_accepts_a_non_generated_filename_shape(): void
    {
        $path = Files::resolveSafeUploadPath('hello.csv', Files::IMPORT_FOLDER, false);

        $this->assertSame(
            rtrim($this->importDir, '/\\') . DIRECTORY_SEPARATOR . 'hello.csv',
            $path
        );
    }

    public function test_resolved_path_stays_under_the_import_folder_when_the_file_exists(): void
    {
        $filename = md5('exists-check') . '.csv';
        $filePath = $this->importDir . '/' . $filename;
        FileFacade::put($filePath, 'name,email\nAda,ada@example.com');

        try {
            $path = Files::resolveSafeUploadPath($filename, Files::IMPORT_FOLDER, true);

            $this->assertStringStartsWith(realpath($this->importDir), $path);
        } finally {
            FileFacade::delete($filePath);
        }
    }
}
