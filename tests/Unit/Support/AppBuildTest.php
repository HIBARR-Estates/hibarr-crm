<?php

namespace Tests\Unit\Support;

use App\Support\AppBuild;
use Tests\TestCase;

class AppBuildTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        parent::setUp();
        AppBuild::forget();
        $this->tempDir = sys_get_temp_dir().DIRECTORY_SEPARATOR.'app-build-'.uniqid('', true);
        mkdir($this->tempDir);
    }

    protected function tearDown(): void
    {
        AppBuild::forget();
        foreach (glob($this->tempDir.DIRECTORY_SEPARATOR.'*') ?: [] as $file) {
            unlink($file);
        }
        rmdir($this->tempDir);
        parent::tearDown();
    }

    public function test_read_from_returns_id_from_valid_json(): void
    {
        $path = $this->writeFile('{"id":"12345-a1b2c3d"}');

        $this->assertSame('12345-a1b2c3d', AppBuild::readFrom($path));
    }

    public function test_read_from_returns_null_when_file_missing(): void
    {
        $this->assertNull(AppBuild::readFrom($this->tempDir.DIRECTORY_SEPARATOR.'missing.json'));
    }

    public function test_read_from_returns_null_for_invalid_json(): void
    {
        $path = $this->writeFile('{not json');

        $this->assertNull(AppBuild::readFrom($path));
    }

    public function test_read_from_returns_null_when_id_missing_or_empty(): void
    {
        $this->assertNull(AppBuild::readFrom($this->writeFile('{"sha":"abc"}')));
        $this->assertNull(AppBuild::readFrom($this->writeFile('{"id":""}')));
        $this->assertNull(AppBuild::readFrom($this->writeFile('{"id":null}')));
        $this->assertNull(AppBuild::readFrom($this->writeFile('[]')));
    }

    public function test_id_is_null_when_public_file_is_absent(): void
    {
        $path = public_path('build-version.json');
        if (is_file($path)) {
            $this->markTestSkipped('public/build-version.json is present in this environment');
        }

        $this->assertNull(AppBuild::id());
    }

    public function test_client_id_is_null_outside_production_and_staging(): void
    {
        $this->assertSame('testing', app()->environment());
        $this->assertNull(AppBuild::clientId());
    }

    private function writeFile(string $contents): string
    {
        $path = $this->tempDir.DIRECTORY_SEPARATOR.uniqid('build-', true).'.json';
        file_put_contents($path, $contents);

        return $path;
    }
}
