<?php

namespace Tests\Unit\Http\Controllers\Api;

use App\Http\Controllers\Api\DealContactApiController;
use App\Models\DealAutomation;
use App\Models\Lead;
use App\Services\DealAutomationService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use ReflectionMethod;
use Tests\TestCase;

/**
 * fireLeadApiTrigger() is the only thing standing between the external API's
 * saveQuietly() writes (which never fire LeadObserver) and an automation
 * built on lead_created_api/lead_updated_api ever seeing them.
 *
 * Callers must fire it only after every write this request owns (lead columns,
 * custom fields, marketing, and on deal/create the deal job) so conditions
 * see the lead's final state — see DealContactApiController::createDeal()/
 * createOrUpdateContact().
 */
class DealContactApiControllerTriggerTest extends TestCase
{
    private int $companyId = 1;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();
        $this->seedCompany();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_it_fires_lead_created_api_when_was_created_is_true(): void
    {
        $leadId = $this->insertLead();
        $lead = Lead::withoutGlobalScopes()->findOrFail($leadId);
        $this->assertFalse($lead->wasRecentlyCreated, 'a reloaded row must not decide create vs update');

        $mock = Mockery::mock(DealAutomationService::class);
        $mock->shouldReceive('processLead')
            ->once()
            ->with(
                Mockery::on(fn ($subject) => $subject instanceof Lead && (int) $subject->id === $leadId),
                DealAutomation::TRIGGER_LEAD_CREATED_API
            );
        $this->app->instance(DealAutomationService::class, $mock);

        $this->invokeFireLeadApiTrigger($leadId, true);
    }

    public function test_it_fires_lead_updated_api_when_was_created_is_false(): void
    {
        $leadId = $this->insertLead();

        $mock = Mockery::mock(DealAutomationService::class);
        $mock->shouldReceive('processLead')
            ->once()
            ->with(
                Mockery::on(fn ($subject) => $subject instanceof Lead && (int) $subject->id === $leadId),
                DealAutomation::TRIGGER_LEAD_UPDATED_API
            );
        $this->app->instance(DealAutomationService::class, $mock);

        $this->invokeFireLeadApiTrigger($leadId, false);
        $this->addToAssertionCount(1);
    }

    public function test_it_reloads_the_lead_so_marketing_written_after_save_is_visible(): void
    {
        $leadId = $this->insertLead();

        $this->invokeSaveUtmInfo($leadId, new Request([
            'utmInfo' => [
                'source' => 'facebook',
                'medium' => 'cpc',
                'campaign' => 'spring',
            ],
        ]));

        $mock = Mockery::mock(DealAutomationService::class);
        $mock->shouldReceive('processLead')
            ->once()
            ->with(
                Mockery::on(function ($subject) use ($leadId) {
                    if (! $subject instanceof Lead || (int) $subject->id !== $leadId) {
                        return false;
                    }

                    $marketing = $subject->marketing;

                    return $marketing !== null
                        && $marketing->utm_source === 'facebook'
                        && $marketing->utm_medium === 'cpc'
                        && $marketing->utm_campaign === 'spring';
                }),
                DealAutomation::TRIGGER_LEAD_CREATED_API
            );
        $this->app->instance(DealAutomationService::class, $mock);

        $this->invokeFireLeadApiTrigger($leadId, true);
        $this->addToAssertionCount(1);
    }

    public function test_it_reloads_the_lead_so_owner_set_after_save_is_visible(): void
    {
        $leadId = $this->insertLead();

        DB::table('leads')->where('id', $leadId)->update(['lead_owner' => 42]);

        $mock = Mockery::mock(DealAutomationService::class);
        $mock->shouldReceive('processLead')
            ->once()
            ->with(
                Mockery::on(function ($subject) use ($leadId) {
                    return $subject instanceof Lead
                        && (int) $subject->id === $leadId
                        && (int) $subject->lead_owner === 42;
                }),
                DealAutomation::TRIGGER_LEAD_CREATED_API
            );
        $this->app->instance(DealAutomationService::class, $mock);

        $this->invokeFireLeadApiTrigger($leadId, true);
        $this->addToAssertionCount(1);
    }

    public function test_resolve_contact_does_not_fire_the_trigger(): void
    {
        $mock = Mockery::mock(DealAutomationService::class);
        $mock->shouldReceive('processLead')->never();
        $this->app->instance(DealAutomationService::class, $mock);

        $result = $this->invokeResolveContact(new Request([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.com',
            'phone' => '+49151',
        ]), $this->companyId);

        $this->assertTrue($result['was_created']);
        $this->assertTrue($result['should_fire']);
        $this->assertGreaterThan(0, $result['id']);
        $this->assertDatabaseHas('leads', [
            'id' => $result['id'],
            'client_email' => 'ada@example.com',
        ]);
    }

    public function test_resolve_contact_marks_an_unchanged_existing_lead_not_to_fire(): void
    {
        $leadId = $this->insertLead([
            'client_name' => 'Ada Lovelace',
            'client_email' => 'ada@example.com',
            'mobile' => '+49151',
        ]);

        $mock = Mockery::mock(DealAutomationService::class);
        $mock->shouldReceive('processLead')->never();
        $this->app->instance(DealAutomationService::class, $mock);

        $result = $this->invokeResolveContact(new Request([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.com',
            'phone' => '+49151',
        ]), $this->companyId);

        $this->assertSame($leadId, $result['id']);
        $this->assertFalse($result['was_created']);
        $this->assertFalse($result['should_fire']);
    }

    private function invokeFireLeadApiTrigger(int $leadId, bool $wasCreated): void
    {
        $controller = new DealContactApiController;
        $method = new ReflectionMethod($controller, 'fireLeadApiTrigger');
        $method->setAccessible(true);
        $method->invoke($controller, $leadId, $wasCreated);
    }

    private function invokeSaveUtmInfo(int $leadId, Request $request): void
    {
        $controller = new DealContactApiController;
        $method = new ReflectionMethod($controller, 'saveUtmInfo');
        $method->setAccessible(true);
        $method->invoke($controller, $leadId, $request);
    }

    /**
     * @return array{id: int, was_created: bool, should_fire: bool}
     */
    private function invokeResolveContact(Request $request, int $companyId): array
    {
        $controller = new DealContactApiController;
        $method = new ReflectionMethod($controller, 'resolveContact');
        $method->setAccessible(true);

        return $method->invoke($controller, $request, $companyId);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function insertLead(array $overrides = []): int
    {
        return (int) DB::table('leads')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'client_name' => 'Test Lead',
            'client_email' => 'lead'.uniqid('', true).'@test.com',
            'mobile' => null,
            'lead_owner' => null,
            'added_by' => 1,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }

    private function seedCompany(): void
    {
        DB::table('companies')->insert([
            'id' => $this->companyId,
            'company_name' => 'Test Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('lead_marketing');
        Schema::dropIfExists('leads');
        Schema::dropIfExists('companies');
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->string('client_email')->nullable();
            $table->string('mobile')->nullable();
            $table->string('gender')->nullable();
            $table->string('temperature')->nullable();
            $table->text('address')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('country')->nullable();
            $table->string('postal_code')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->text('languages')->nullable();
            $table->string('nationality')->nullable();
            $table->string('occupation')->nullable();
            $table->string('preferred_contact_time')->nullable();
            $table->text('preferred_contact_times')->nullable();
            $table->unsignedInteger('source_id')->nullable();
            $table->unsignedInteger('lead_lifecycle_status_id')->nullable();
            $table->unsignedInteger('referred_by_agent_id')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('lead_marketing', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id')->nullable();
            $table->string('utm_source')->nullable();
            $table->string('utm_medium')->nullable();
            $table->string('utm_campaign')->nullable();
            $table->string('utm_content')->nullable();
            $table->string('utm_term')->nullable();
            $table->string('utm_audience')->nullable();
            $table->boolean('has_registered_for_the_webinar')->default(false);
            $table->boolean('has_joined_the_facebook_group')->default(false);
            $table->boolean('has_joined_the_whatsapp_group')->default(false);
            $table->boolean('has_downloaded_the_ebook')->default(false);
            $table->boolean('has_attended_the_webinar')->default(false);
            $table->boolean('registered_for_zoom_meeting')->default(false);
            $table->date('last_webinar_date')->nullable();
            $table->integer('contact_score')->nullable();
            $table->timestamps();
        });
    }
}
