<?php

namespace Tests\Feature\Leads;

use App\Http\Controllers\Api\DealContactApiController;
use App\Models\Lead;
use App\Services\CrmEventService;
use App\Services\DealAutomationService;
use App\Services\LeadApiChangeRecorder;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\LeadCoreFieldsTestCase;

/**
 * The backend pushes every lead it touches through contact/create and
 * deal/create. Once the CRM has a lead, those pushes may only fill what is
 * empty — never overwrite — and list-like data (languages, contact times,
 * categories, multi-value custom fields) only ever grows. Each change shows up
 * on the lead's timeline and on its deals' timelines.
 */
class ApiExistingLeadFillOnlyTest extends LeadCoreFieldsTestCase
{
    private int $companyId;

    /** @var list<array<string, mixed>> */
    private array $recordedEvents = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->resetSchema();
        $this->createMinimalSchema();

        $this->companyId = DB::table('companies')->insertGetId(['company_name' => 'Test Co']);
        DB::table('language_settings')->insert([
            ['language_code' => 'de', 'language_name' => 'German', 'status' => 'enabled'],
            ['language_code' => 'en', 'language_name' => 'English', 'status' => 'enabled'],
        ]);

        $automation = Mockery::mock(DealAutomationService::class);
        $automation->shouldIgnoreMissing();
        $this->app->instance(DealAutomationService::class, $automation);

        $events = Mockery::mock(CrmEventService::class);
        $events->shouldReceive('record')->andReturnUsing(function (array $params) {
            $this->recordedEvents[] = $params;

            return null;
        });
        $this->app->instance(CrmEventService::class, $events);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_existing_values_are_never_overwritten(): void
    {
        $source = $this->seedSource('Referral');
        $otherSource = $this->seedSource('Website');
        $leadId = $this->seedLead([
            'client_name' => 'Ada Lovelace',
            'mobile' => '+49 111',
            'gender' => 'female',
            'source_id' => $source,
            'city' => 'Berlin',
            'date_of_birth' => '1990-01-01',
            'nationality' => 'German',
            'temperature' => 'hot',
            'salutation' => 'mrs',
            'lead_lifecycle_status_id' => 3,
        ]);

        $this->resolveContact([
            'name' => 'Ada L.',
            'phone' => '+49 999',
            'gender' => 'male',
            'lead_source_id' => $otherSource,
            'city' => 'Hamburg',
            'date_of_birth' => '1985-05-05',
            'nationality' => 'Turkish',
            'temperature' => 'cold',
            'salutation' => 'dr',
            'lead_lifecycle_status_id' => 1,
        ]);

        $lead = DB::table('leads')->find($leadId);
        $this->assertSame('Ada Lovelace', $lead->client_name);
        $this->assertSame('+49 111', $lead->mobile);
        $this->assertSame('female', $lead->gender);
        $this->assertSame($source, (int) $lead->source_id);
        $this->assertSame('Berlin', $lead->city);
        $this->assertStringStartsWith('1990-01-01', $lead->date_of_birth);
        $this->assertSame('German', $lead->nationality);
        $this->assertSame('hot', $lead->temperature);
        $this->assertSame('mrs', $lead->salutation);
        $this->assertSame(3, (int) $lead->lead_lifecycle_status_id);
        $this->assertSame([], $this->recordedEvents, 'Nothing changed, so nothing is recorded');
    }

    public function test_empty_values_are_filled(): void
    {
        $source = $this->seedSource('Website');
        $leadId = $this->seedLead(['mobile' => null, 'city' => null, 'source_id' => null, 'temperature' => null]);

        $this->resolveContact([
            'phone' => '+49 999',
            'gender' => 'male',
            'lead_source_id' => $source,
            'city' => 'Hamburg',
            'nationality' => 'Turkish',
            'temperature' => 'warm',
        ]);

        $lead = DB::table('leads')->find($leadId);
        $this->assertSame('+49 999', $lead->mobile);
        $this->assertSame('male', $lead->gender);
        $this->assertSame($source, (int) $lead->source_id);
        $this->assertSame('Hamburg', $lead->city);
        $this->assertSame('Turkish', $lead->nationality);
        $this->assertSame('warm', $lead->temperature);
    }

    public function test_empty_values_in_the_request_never_wipe_stored_ones(): void
    {
        $leadId = $this->seedLead(['city' => 'Berlin', 'gender' => 'female']);

        $this->resolveContact(['city' => '', 'gender' => null, 'preferred_contact_times' => []]);

        $lead = DB::table('leads')->find($leadId);
        $this->assertSame('Berlin', $lead->city);
        $this->assertSame('female', $lead->gender);
    }

    public function test_languages_and_preferred_contact_times_are_additive(): void
    {
        $leadId = $this->seedLead([
            'languages' => json_encode(['de']),
            'preferred_contact_times' => json_encode(['morning']),
            'preferred_contact_time' => 'morning',
        ]);

        $this->resolveContact([
            'languages' => ['en', 'de'],
            'preferred_contact_times' => ['evening'],
        ]);

        $lead = Lead::withoutGlobalScopes()->find($leadId);
        $this->assertSame(['de', 'en'], $lead->languages);
        $this->assertSame(['morning', 'evening'], $lead->preferred_contact_times);
    }

    public function test_categories_are_additive_and_keep_the_primary(): void
    {
        $first = DB::table('lead_category')->insertGetId(['company_id' => $this->companyId, 'category_name' => 'Investor']);
        $second = DB::table('lead_category')->insertGetId(['company_id' => $this->companyId, 'category_name' => 'Buyer']);
        $leadId = $this->seedLead(['category_id' => $first]);
        DB::table('lead_lead_category')->insert(['lead_id' => $leadId, 'lead_category_id' => $first]);

        $lead = Lead::withoutGlobalScopes()->find($leadId);
        $this->invoke('applyLeadCategories', $lead, new Request(['lead_category_ids' => [$second]]));

        $this->assertEqualsCanonicalizing(
            [$first, $second],
            DB::table('lead_lead_category')->where('lead_id', $leadId)->pluck('lead_category_id')->map(fn ($id) => (int) $id)->all()
        );
        $this->assertSame($first, (int) DB::table('leads')->where('id', $leadId)->value('category_id'));
    }

    public function test_custom_fields_fill_empty_ones_and_merge_multi_value_ones(): void
    {
        $groupId = DB::table('custom_field_groups')->insertGetId(['company_id' => $this->companyId, 'model' => Lead::CUSTOM_FIELD_MODEL]);
        $note = $this->seedCustomField($groupId, 'note', 'text');
        $budget = $this->seedCustomField($groupId, 'budget', 'text');
        $interests = $this->seedCustomField($groupId, 'interests', 'checkbox');
        $leadId = $this->seedLead();
        DB::table('custom_fields_data')->insert([
            ['custom_field_id' => $note, 'model_id' => $leadId, 'model' => Lead::CUSTOM_FIELD_MODEL, 'value' => 'Called twice'],
            ['custom_field_id' => $interests, 'model_id' => $leadId, 'model' => Lead::CUSTOM_FIELD_MODEL, 'value' => json_encode(['villas'])],
        ]);

        $this->resolveContact(['lead_custom_fields' => [
            (string) $note => 'Overwritten?',
            (string) $budget => '500k',
            (string) $interests => ['apartments', 'villas'],
        ]]);

        $values = DB::table('custom_fields_data')->where('model_id', $leadId)->pluck('value', 'custom_field_id');
        $this->assertSame('Called twice', $values[$note]);
        $this->assertSame('500k', $values[$budget]);
        $this->assertSame(['villas', 'apartments'], json_decode($values[$interests], true));
    }

    public function test_marketing_flags_only_move_to_true_and_scalars_are_fill_only(): void
    {
        $leadId = $this->seedLead();
        DB::table('lead_marketing')->insert([
            'lead_id' => $leadId,
            'has_attended_the_webinar' => true,
            'has_downloaded_the_ebook' => false,
            'contact_score' => 40,
        ]);

        $this->invoke('saveUtmInfo', $leadId, new Request([
            'has_attended_the_webinar' => false,
            'has_downloaded_the_ebook' => true,
            'contact_score' => 90,
            'ip_address' => '10.0.0.1',
        ]));

        $marketing = DB::table('lead_marketing')->where('lead_id', $leadId)->first();
        $this->assertSame(1, (int) $marketing->has_attended_the_webinar);
        $this->assertSame(1, (int) $marketing->has_downloaded_the_ebook);
        $this->assertSame(40, (int) $marketing->contact_score);
        $this->assertSame('10.0.0.1', $marketing->ip_address);
    }

    public function test_filled_fields_are_recorded_on_the_lead_and_its_deals(): void
    {
        $leadId = $this->seedLead(['city' => null]);
        $dealId = DB::table('deals')->insertGetId(['company_id' => $this->companyId, 'lead_id' => $leadId]);

        $recorder = app(LeadApiChangeRecorder::class);
        $before = $recorder->snapshot($leadId);
        $this->resolveContact(['city' => 'Hamburg']);
        $labels = $recorder->recordUpdated($leadId, $before, LeadApiChangeRecorder::CHANNEL_CONTACT_CREATE);

        $this->assertSame(['City'], $labels);
        $this->assertCount(2, $this->recordedEvents);

        [$leadEvent, $dealEvent] = $this->recordedEvents;
        $this->assertSame('lead_updated', $leadEvent['event_type_slug']);
        $this->assertSame(Lead::class, $leadEvent['model_type']);
        $this->assertSame($leadId, $leadEvent['model_id']);
        $this->assertSame('api', $leadEvent['source']);
        $this->assertSame('Lead updated via API: City', $leadEvent['metadata']['comment']);
        $this->assertSame('Hamburg', $leadEvent['metadata']['changes'][0]['new_value']);

        $this->assertSame('deal_lead_updated', $dealEvent['event_type_slug']);
        $this->assertSame($dealId, $dealEvent['model_id']);
        $this->assertSame($leadId, $dealEvent['metadata']['lead_id']);
    }

    public function test_created_is_recorded_for_quietly_created_leads(): void
    {
        $leadId = $this->seedLead();

        app(LeadApiChangeRecorder::class)->recordCreated($leadId, LeadApiChangeRecorder::CHANNEL_DEAL_CREATE);

        $this->assertCount(1, $this->recordedEvents);
        $this->assertSame('lead_created', $this->recordedEvents[0]['event_type_slug']);
        $this->assertSame('deal_create', $this->recordedEvents[0]['metadata']['channel']);
    }

    private function resolveContact(array $input): array
    {
        return $this->invoke('resolveContact', new Request(array_merge([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.com',
        ], $input)), $this->companyId);
    }

    private function invoke(string $method, mixed ...$args): mixed
    {
        $controller = new DealContactApiController;
        $reflection = new \ReflectionMethod($controller, $method);
        $reflection->setAccessible(true);

        return $reflection->invoke($controller, ...$args);
    }

    private function seedSource(string $type): int
    {
        return DB::table('lead_sources')->insertGetId(['company_id' => $this->companyId, 'type' => $type]);
    }

    private function seedCustomField(int $groupId, string $name, string $type): int
    {
        return DB::table('custom_fields')->insertGetId([
            'company_id' => $this->companyId,
            'custom_field_group_id' => $groupId,
            'label' => ucfirst($name),
            'name' => $name,
            'type' => $type,
        ]);
    }

    private function seedLead(array $extra = []): int
    {
        return DB::table('leads')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'client_name' => 'Ada Lovelace',
            'client_email' => 'ada@example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ], $extra));
    }

    private function resetSchema(): void
    {
        foreach ([
            'deals', 'lead_utm_touches', 'lead_marketing', 'custom_fields_data', 'custom_fields',
            'custom_field_groups', 'lead_lead_category', 'lead_category', 'lead_sources',
            'language_settings', 'leads', 'companies',
        ] as $table) {
            Schema::dropIfExists($table);
        }
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
            $table->string('company_name')->nullable();
            $table->string('mobile')->nullable();
            $table->string('gender')->nullable();
            $table->string('salutation')->nullable();
            $table->string('temperature')->nullable();
            $table->text('address')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('country')->nullable();
            $table->string('postal_code')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->integer('age')->nullable();
            $table->string('age_range')->nullable();
            $table->text('languages')->nullable();
            $table->string('nationality')->nullable();
            $table->string('occupation')->nullable();
            $table->string('preferred_contact_time')->nullable();
            $table->text('preferred_contact_times')->nullable();
            $table->unsignedInteger('source_id')->nullable();
            $table->unsignedInteger('category_id')->nullable();
            $table->unsignedInteger('lead_lifecycle_status_id')->nullable();
            $table->unsignedInteger('referred_by_agent_id')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('language_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->string('language_code');
            $table->string('language_name');
            $table->string('status')->default('enabled');
            $table->timestamps();
        });

        Schema::create('lead_sources', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('type');
            $table->timestamps();
        });

        Schema::create('lead_category', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('category_name');
            $table->timestamps();
        });

        Schema::create('lead_lead_category', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('lead_id');
            $table->unsignedInteger('lead_category_id');
            $table->timestamps();
        });

        Schema::create('custom_field_groups', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('model');
            $table->timestamps();
        });

        Schema::create('custom_fields', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('custom_field_group_id')->nullable();
            $table->string('label');
            $table->string('name');
            $table->string('type')->default('text');
            $table->string('required')->default('no');
        });

        Schema::create('custom_fields_data', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('custom_field_id');
            $table->unsignedInteger('model_id');
            $table->string('model')->nullable();
            $table->text('value')->nullable();
        });

        Schema::create('lead_marketing', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id')->nullable();
            foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_audience',
                'facebook_click_id', 'facebook_lead_id', 'facebook_browser_id', 'user_agent', 'ip_address'] as $column) {
                $table->string($column)->nullable();
            }
            foreach (['has_registered_for_the_webinar', 'has_joined_the_facebook_group', 'has_joined_the_whatsapp_group',
                'has_downloaded_the_ebook', 'has_attended_the_webinar', 'registered_for_zoom_meeting'] as $column) {
                $table->boolean($column)->default(false);
            }
            $table->date('last_webinar_date')->nullable();
            $table->integer('contact_score')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_utm_touches', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('lead_id');
            foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_audience', 'origin'] as $column) {
                $table->string($column)->nullable();
            }
            $table->boolean('is_first_touch')->default(false);
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }
}
