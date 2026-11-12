<?php

namespace Tests\Feature\Settings;

use App\Http\Controllers\PaymentDocumentSettingsController;
use App\Models\PaymentDocumentSetting;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/**
 * Invoices and receipts settings endpoints: permission gate, validation,
 * saving, logo removal and the sample PDF preview.
 */
class PaymentDocumentSettingsControllerTest extends TestCase
{
    private int $companyId = 1;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('database.default', 'sqlite');
        config()->set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });
        (require base_path('database/migrations/2026_11_12_000002_create_payment_document_settings_tables.php'))->up();
        DB::table('companies')->insert(['id' => $this->companyId, 'company_name' => 'Test Co']);

        Http::fake(['https://api.frankfurter.app/*' => Http::response(['date' => '2026-11-12', 'rates' => ['TRY' => 56.2]], 200)]);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();

        parent::tearDown();
    }

    public function test_settings_require_the_manage_company_setting_permission(): void
    {
        $this->actingAsUser('none');
        $gate = $this->permissionGate();

        try {
            $gate(Request::create('/'), fn () => response('ok'));
            $this->fail('Expected users without the permission to be refused.');
        } catch (HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }

        $this->actingAsUser('all');
        $this->assertSame('ok', $gate(Request::create('/'), fn () => response('ok'))->getContent());
    }

    public function test_update_requires_the_seller_details_and_a_valid_range(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser('all');

        $this->putJson(route('payment-document-settings.api.update'), array_merge($this->validPayload(), [
            'legal_name' => '',
            'tax_office' => '',
            'invoice_series' => 'A/B',
            'invoice_number_start' => 500,
            'invoice_number_end' => 100,
            'brand_color' => 'red',
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['legal_name', 'tax_office', 'invoice_series', 'invoice_number_end', 'brand_color']);

        $this->assertSame(0, DB::table('payment_document_settings')->count());
    }

    public function test_update_saves_the_settings_and_returns_the_numbering(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser('all');

        $this->putJson(route('payment-document-settings.api.update'), $this->validPayload())
            ->assertOk()
            ->assertJsonPath('data.settings.saved', true)
            ->assertJsonPath('data.settings.legal_name', 'Örnek Emlak Ltd.')
            ->assertJsonPath('data.numbering.invoice.next', 'B 000240')
            ->assertJsonPath('data.numbering.invoice.remaining', 61);

        $row = DB::table('payment_document_settings')->where('company_id', $this->companyId)->first();
        $this->assertSame('MŞ 23667', $row->tax_number);
        $this->assertSame(99, (int) $row->updated_by);
    }

    public function test_logo_upload_accepts_only_png_and_jpeg(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser('all');

        $this->postJson(route('payment-document-settings.api.logo.store'), [
            'logo' => UploadedFile::fake()->create('logo.svg', 10, 'image/svg+xml'),
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['logo']);
    }

    public function test_removing_the_logo_clears_it(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser('all');
        config()->set('filesystems.default', 'local');
        Schema::create('file_storage', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('filename')->nullable();
            $table->timestamps();
        });
        $logoPath = \App\Helper\Files::resolveSafeUploadPath('test-existing-logo.png', PaymentDocumentSetting::LOGO_PATH);
        File::ensureDirectoryExists(dirname($logoPath));
        File::put($logoPath, 'png');

        DB::table('payment_document_settings')->insert(array_merge($this->validPayload(), [
            'company_id' => $this->companyId,
            'logo' => 'test-existing-logo.png',
            'created_at' => now(),
            'updated_at' => now(),
        ]));

        $this->deleteJson(route('payment-document-settings.api.logo.destroy'))
            ->assertOk()
            ->assertJsonPath('data.settings.logo_url', null);

        $this->assertNull(DB::table('payment_document_settings')->where('company_id', $this->companyId)->value('logo'));
        $this->assertFileDoesNotExist($logoPath);
    }

    public function test_preview_streams_a_sample_pdf_without_taking_a_number(): void
    {
        $this->withoutMiddleware();
        $this->actingAsUser('all');

        foreach (['invoice', 'receipt'] as $kind) {
            $response = $this->get(route('payment-document-settings.api.preview', $kind));
            $response->assertOk();
            $this->assertStringStartsWith('%PDF', $response->getContent());
        }

        $this->get('/account/settings/payment-document-settings/api/preview/other')->assertNotFound();
        $this->assertSame(0, DB::table('payment_documents')->count());
    }

    /**
     * @return array<string, mixed>
     */
    private function validPayload(): array
    {
        return [
            'legal_name' => 'Örnek Emlak Ltd.',
            'address' => "Ecevit Cad. 12\nGirne, KKTC",
            'phone' => '+90 392 000 00 00',
            'email' => 'muhasebe@example.com',
            'tax_office' => 'Girne',
            'tax_number' => 'MŞ 23667',
            'registration_number' => null,
            'brand_color' => '#1d4d5c',
            'invoice_series' => 'B',
            'invoice_number_start' => 240,
            'invoice_number_end' => 300,
            'receipt_series' => 'T',
            'receipt_number_start' => 1,
            'receipt_number_end' => null,
            'number_padding' => 6,
            'vat_rate' => 16,
            'approval_number' => 'GVD/2026/0412',
            'show_stamp_duty' => true,
            'show_approval_seal' => true,
            'bank_name' => 'Örnek Bank',
            'bank_account_name' => 'Örnek Emlak Ltd.',
            'iban' => 'TR00 0000 0000 0000 0000 0000 00',
            'swift' => 'ORNKTR2A',
            'payment_term_days' => 14,
            'show_try_equivalent' => true,
            'bilingual_labels' => true,
            'footer_note' => null,
        ];
    }

    private function actingAsUser(string $permission): void
    {
        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = 99;
        $user->name = 'Admin';
        $user->company_id = $this->companyId;
        $user->shouldReceive('permission')->andReturn($permission);
        $this->actingAs($user);
        session(['user' => $user, 'company' => (object) ['id' => $this->companyId]]);
    }

    /**
     * The controller's own middleware: the last one it registers, after the
     * shared account middleware from its parents.
     */
    private function permissionGate(): \Closure
    {
        $controller = app(PaymentDocumentSettingsController::class);
        $middleware = $controller->getMiddleware();

        return end($middleware)['middleware'];
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('file_storage');
        Schema::dropIfExists('payment_documents');
        Schema::dropIfExists('payment_document_settings');
        Schema::dropIfExists('companies');
    }
}
