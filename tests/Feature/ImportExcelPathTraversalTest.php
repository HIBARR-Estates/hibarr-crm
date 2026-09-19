<?php

namespace Tests\Feature;

use App\Helper\Files;
use App\Imports\LeadImport;
use App\Jobs\ImportLeadJob;
use App\Traits\ImportExcel;
use Froiden\RestAPI\Exceptions\ApiException;
use Illuminate\Bus\PendingBatch;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File as FileFacade;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Session;
use Tests\TestCase;

/**
 * Regression coverage for P1-02 (path traversal in the import wizard's `file`
 * param). importJobProcess() must never trust a client-supplied `file` value
 * for path-building — it should resolve the server-generated filename from
 * the session that importFileProcess() populated in step 1.
 */
class ImportExcelPathTraversalTest extends TestCase
{
    /** @var array<int, string> */
    private array $createdFiles = [];

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('file_storage');
        Schema::create('file_storage', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('path');
            $table->string('filename');
            $table->string('type', 50)->nullable();
            $table->unsignedInteger('size');
            $table->string('storage_location')->default('local');
            $table->timestamps();
        });

        // company()/user() read straight from session in this app.
        session(['user' => (object) ['id' => 1], 'company' => (object) ['id' => 1]]);
    }

    protected function tearDown(): void
    {
        foreach ($this->createdFiles as $path) {
            if (FileFacade::exists($path)) {
                FileFacade::delete($path);
            }
        }

        Schema::dropIfExists('file_storage');

        parent::tearDown();
    }

    private function host(): object
    {
        return new class {
            use ImportExcel;

            public $importClassName;
            public $file;
            public $hasHeading;
            public $heading;
            public $fileHeading;
            public $columns;
            public $importMatchedColumns;
            public $matchedColumns;
            public $importSample;
        };
    }

    private function uploadRequest(string $csv): Request
    {
        $upload = UploadedFile::fake()->createWithContent('leads.csv', $csv);

        return Request::create('/', 'POST', [], [], ['import_file' => $upload]);
    }

    public function test_step_one_stores_the_generated_filename_in_session(): void
    {
        $host = $this->host();

        $host->importFileProcess($this->uploadRequest("name\nAda Lovelace\n"), LeadImport::class);

        $this->createdFiles[] = public_path(Files::UPLOAD_FOLDER . '/' . Files::IMPORT_FOLDER . '/' . $host->file);

        $this->assertNotEmpty($host->file);
        $this->assertSame($host->file, Session::get('import.LeadImport.file'));
    }

    public function test_step_two_ignores_a_forged_file_param_and_uses_the_session_file(): void
    {
        Bus::fake();

        $host = $this->host();
        $host->importFileProcess($this->uploadRequest("name\nAda Lovelace\n"), LeadImport::class);

        $legitimateFile = $host->file;
        $this->createdFiles[] = public_path(Files::UPLOAD_FOLDER . '/' . Files::IMPORT_FOLDER . '/' . $legitimateFile);

        // Attacker forges the step-2 payload directly, bypassing the hidden field entirely.
        $forgedRequest = Request::create('/', 'POST', [
            'file' => '../../../../.env',
            'has_heading' => true,
            'columns' => [0 => 'name'],
        ]);

        $batch = $host->importJobProcess($forgedRequest, LeadImport::class, ImportLeadJob::class);

        $this->assertNotNull($batch);
        Bus::assertBatched(function (PendingBatch $pendingBatch) {
            return $pendingBatch->jobs->count() === 1;
        });

        // Session key is cleared after use — no replay against a stale reference.
        $this->assertNull(Session::get('import.LeadImport.file'));

        // The forged path was never resolved or touched, by read or by delete —
        // and the legitimately uploaded file was cleaned up as usual.
        $this->assertFileExists(base_path('.env'));
        $this->assertFileDoesNotExist(public_path(Files::UPLOAD_FOLDER . '/' . Files::IMPORT_FOLDER . '/' . $legitimateFile));
    }

    public function test_step_two_rejects_a_cold_call_with_no_prior_upload(): void
    {
        $host = $this->host();

        $this->expectException(ApiException::class);

        try {
            $host->importJobProcess(
                Request::create('/', 'POST', [
                    'file' => '../../../../.env',
                    'has_heading' => true,
                    'columns' => [0 => 'name'],
                ]),
                LeadImport::class,
                ImportLeadJob::class
            );
        } finally {
            $this->assertFileExists(base_path('.env'));
        }
    }

    public function test_delete_file_rejects_traversal_and_leaves_files_outside_the_upload_dir_untouched(): void
    {
        // basename() strips any path separators regardless of payload shape, so a
        // handful of representative traversal payloads is enough to prove the guard.
        foreach (['../../../../.env', '..\\..\\..\\.env', '/etc/passwd'] as $payload) {
            $result = Files::deleteFile($payload, Files::IMPORT_FOLDER);

            $this->assertTrue($result);
            $this->assertFileExists(base_path('.env'));
        }
    }
}
