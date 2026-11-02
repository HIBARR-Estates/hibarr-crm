<?php

namespace Tests\Unit\EntitySummary;

use App\Enums\Salutation;
use App\Models\Lead;
use App\Models\LeadMarketing;
use App\Services\EntitySummary\DealSummarySnapshotService;
use App\Services\EntitySummary\EntitySummaryPromptLoader;
use App\Services\EntitySummary\LeadSummaryInputBuilder;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class LeadSummaryInputBuilderTest extends TestCase
{
    private const TABLES = [
        'taskables',
        'tasks',
        'lead_follow_up',
        'lead_notes',
        'deals',
        'hibarr_deal_custom_fields',
        'lead_qualification_answers',
        'lead_qualifications',
        'custom_fields_data',
        'custom_fields',
        'custom_field_groups',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake();

        $this->dropTables();

        Schema::create('deals', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_id')->nullable();
            $table->unsignedInteger('company_id')->nullable();
            $table->timestamps();
        });

        Schema::create('hibarr_deal_custom_fields', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('deal_id');
            $table->string('interested_in')->nullable();
            $table->text('motivation')->nullable();
            $table->string('purchase_timeline')->nullable();
            $table->string('budget_range')->nullable();
            $table->text('message')->nullable();
            $table->boolean('strategy_meeting_booked')->nullable();
            $table->boolean('downpayment_paid')->nullable();
            $table->date('inspection_trip_date')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_notes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_id')->nullable();
            $table->unsignedBigInteger('added_by')->nullable();
            $table->text('details')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_id')->nullable();
            $table->string('remark')->nullable();
            $table->timestamp('next_follow_up_date')->nullable();
            $table->string('status')->nullable();
            $table->timestamps();
        });

        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->string('heading')->nullable();
            $table->unsignedBigInteger('board_column_id')->nullable();
            $table->timestamp('due_date')->nullable();
            $table->timestamps();
        });

        Schema::create('taskables', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('task_id');
            $table->unsignedBigInteger('taskable_id');
            $table->string('taskable_type');
        });

        Schema::create('lead_qualifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id');
            $table->string('template_id')->default('3');
            $table->unsignedInteger('template_version')->default(1);
            $table->string('template_name')->nullable();
            $table->unsignedInteger('agent_id')->default(1);
            $table->string('status')->default('inProgress');
            $table->string('outcome')->nullable();
            $table->json('outcomes')->nullable();
            $table->text('outcome_comment')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_qualification_answers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_qualification_id');
            $table->string('segment_key');
            $table->text('question_label')->nullable();
            $table->json('answer_values')->nullable();
            $table->json('answer_labels')->nullable();
            $table->text('answer_text')->nullable();
            $table->timestamps();
        });

        Schema::create('custom_field_groups', function (Blueprint $table) {
            $table->id();
            $table->string('model');
        });

        Schema::create('custom_fields', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('custom_field_group_id');
            $table->string('label');
            $table->string('name')->nullable();
            $table->string('type')->default('text');
            $table->integer('display_order')->default(0);
        });

        Schema::create('custom_fields_data', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('custom_field_id');
            $table->string('model');
            $table->unsignedBigInteger('model_id');
            $table->text('value')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->dropTables();

        parent::tearDown();
    }

    private function dropTables(): void
    {
        foreach (self::TABLES as $table) {
            Schema::dropIfExists($table);
        }
    }

    public function test_build_does_not_crash_when_salutation_is_enum(): void
    {
        $lead = $this->makeLeadForBuilder([
            'id' => 8521,
            'client_name' => 'Jane Doe',
            'salutation' => Salutation::Mr,
        ]);

        $payload = app(LeadSummaryInputBuilder::class)->build($lead);

        $this->assertSame('buyer', $payload['lead']['type']);
    }

    public function test_payload_contains_no_personal_identifiers(): void
    {
        $lead = $this->makeLeadForBuilder([
            'id' => 10,
            'client_name' => 'Jane Doe',
            'salutation' => Salutation::Mr,
            'client_email' => 'jane.doe@example.com',
            'mobile' => '+905338773001',
            'office' => '+902421234567',
            'company_name' => 'Acme Holdings',
            'date_of_birth' => '1990-04-12',
            'nationality' => 'German',
            'country' => 'Germany',
            'city' => 'Munich',
            'occupation' => 'Engineer at Acme Holdings',
            'client_whatsapp' => '+905338773001',
        ]);

        DB::table('lead_notes')->insert([
            'lead_id' => 10,
            'details' => '<p>Jane Doe called from +90 533 877 3001, email jane.doe@example.com. Wants a 2-bed in Antalya.</p>',
            'created_at' => Carbon::now()->subDays(3),
            'updated_at' => Carbon::now()->subDays(3),
        ]);

        $payload = app(LeadSummaryInputBuilder::class)->build($lead);
        $json = json_encode($payload);

        foreach (['Jane', 'Doe', 'jane.doe@example.com', '905338773001', '533 877', '2421234567', 'Acme', '1990-04-12'] as $pii) {
            $this->assertStringNotContainsString($pii, $json, "payload leaked: {$pii}");
        }

        $this->assertArrayNotHasKey('name', $payload['lead']);
        $this->assertArrayNotHasKey('owner', $payload['lead']);
        $this->assertArrayNotHasKey('added_by', $payload['lead']);

        // What the summary is allowed to know about the person.
        $this->assertSame('German', $payload['sections']['profile']['nationality']);
        $this->assertSame('Munich', $payload['sections']['profile']['city']);
        $this->assertSame(['email', 'phone', 'whatsapp'], $payload['sections']['profile']['reachable_via']);
        $this->assertStringContainsString('2-bed in Antalya', $payload['sections']['notes'][0]['text']);
    }

    public function test_notes_carry_day_counts_and_drive_last_logged_activity(): void
    {
        $lead = $this->makeLeadForBuilder(['id' => 11, 'client_name' => 'Sam Lead']);

        DB::table('lead_notes')->insert([
            ['lead_id' => 11, 'details' => 'Older note', 'created_at' => Carbon::now()->subDays(20), 'updated_at' => Carbon::now()->subDays(20)],
            ['lead_id' => 11, 'details' => 'Recent note', 'created_at' => Carbon::now()->subDays(4), 'updated_at' => Carbon::now()->subDays(4)],
        ]);

        $payload = app(LeadSummaryInputBuilder::class)->build($lead);

        $this->assertSame(
            [['days_ago' => 4, 'text' => 'Recent note'], ['days_ago' => 20, 'text' => 'Older note']],
            $payload['sections']['notes']
        );
        $this->assertSame(4, $payload['lead']['last_logged_activity_days_ago']);
    }

    public function test_notes_are_not_truncated_to_a_two_hundred_character_excerpt(): void
    {
        $lead = $this->makeLeadForBuilder(['id' => 12, 'client_name' => 'Sam Lead']);
        $long = str_repeat('Interested in sea view. ', 20); // ~480 chars

        DB::table('lead_notes')->insert([
            'lead_id' => 12, 'details' => $long, 'created_at' => now(), 'updated_at' => now(),
        ]);

        $payload = app(LeadSummaryInputBuilder::class)->build($lead);

        $this->assertGreaterThan(400, mb_strlen($payload['sections']['notes'][0]['text']));
    }

    public function test_no_activity_means_no_last_logged_activity_key(): void
    {
        $lead = $this->makeLeadForBuilder(['id' => 13, 'client_name' => 'Sam Lead']);

        $payload = app(LeadSummaryInputBuilder::class)->build($lead);

        $this->assertArrayNotHasKey('last_logged_activity_days_ago', $payload['lead']);
        $this->assertSame([], $payload['sections']);
    }

    public function test_qualification_answers_arrive_as_question_and_answer(): void
    {
        $lead = $this->makeLeadForBuilder(['id' => 14, 'client_name' => 'Sam Lead']);

        $callId = DB::table('lead_qualifications')->insertGetId([
            'lead_id' => 14,
            'template_name' => 'Buyer qualification',
            'status' => 'completed',
            'outcomes' => json_encode(['inviteWebinar']),
            'outcome_comment' => 'Wants to hear more first.',
            'started_at' => Carbon::now()->subDays(12)->subMinutes(30),
            'completed_at' => Carbon::now()->subDays(12),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('lead_qualification_answers')->insert([
            [
                'lead_qualification_id' => $callId, 'segment_key' => 'q_type',
                'question_label' => 'What type of property?',
                'answer_values' => json_encode(['apartment']), 'answer_labels' => json_encode(['Apartment']),
                'answer_text' => '2 bedrooms, sea view', 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                'lead_qualification_id' => $callId, 'segment_key' => 'q_budget',
                'question_label' => 'Budget?',
                'answer_values' => json_encode(['b2']), 'answer_labels' => json_encode(['200,000 - 250,000 EUR']),
                'answer_text' => null, 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                // Typed answer: no option labels, the text is the answer.
                'lead_qualification_id' => $callId, 'segment_key' => 'q_why',
                'question_label' => 'Why Antalya?',
                'answer_values' => json_encode([]), 'answer_labels' => null,
                'answer_text' => 'Rental income', 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                // Saved before label snapshots existed: only typed context survives.
                'lead_qualification_id' => $callId, 'segment_key' => 'q_legacy',
                'question_label' => null,
                'answer_values' => json_encode(['opt_1']), 'answer_labels' => null,
                'answer_text' => 'Partner decides too', 'created_at' => now(), 'updated_at' => now(),
            ],
            [
                // Opaque option key with no label and no text is useless to the model.
                'lead_qualification_id' => $callId, 'segment_key' => 'q_opaque',
                'question_label' => null,
                'answer_values' => json_encode(['opt_9']), 'answer_labels' => null,
                'answer_text' => null, 'created_at' => now(), 'updated_at' => now(),
            ],
        ]);

        $call = app(LeadSummaryInputBuilder::class)->build($lead)['sections']['qualification_calls'][0];

        $this->assertSame('Buyer qualification', $call['script']);
        $this->assertSame('completed', $call['status']);
        $this->assertSame(12, $call['days_ago']);
        $this->assertSame(['inviteWebinar'], $call['outcomes']);
        $this->assertSame([
            ['question' => 'What type of property?', 'answer' => 'Apartment', 'details' => '2 bedrooms, sea view'],
            ['question' => 'Budget?', 'answer' => '200,000 - 250,000 EUR'],
            ['question' => 'Why Antalya?', 'answer' => 'Rental income'],
            ['answer' => 'Partner decides too'],
        ], $call['answers']);
    }

    public function test_empty_abandoned_qualification_is_left_out(): void
    {
        $lead = $this->makeLeadForBuilder(['id' => 15, 'client_name' => 'Sam Lead']);

        DB::table('lead_qualifications')->insert([
            'lead_id' => 15, 'status' => 'abandoned', 'started_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);

        $payload = app(LeadSummaryInputBuilder::class)->build($lead);

        $this->assertArrayNotHasKey('qualification_calls', $payload['sections']);
    }

    public function test_lead_details_include_custom_fields_but_not_identifiers(): void
    {
        $lead = $this->makeLeadForBuilder(['id' => 16, 'client_name' => 'Sam Lead']);

        $groupId = DB::table('custom_field_groups')->insertGetId(['model' => Lead::CUSTOM_FIELD_MODEL]);
        $fields = [
            ['label' => 'Budget', 'type' => 'text', 'value' => '€200–250K'],
            ['label' => 'Property types', 'type' => 'multiselect', 'value' => json_encode(['Apartment', 'Villa'])],
            ['label' => 'Passport number', 'type' => 'text', 'value' => 'C01X00T47'],
            ['label' => 'Home address', 'type' => 'text', 'value' => '1 Example Street'],
            ['label' => 'Contract upload', 'type' => 'file', 'value' => 'contract.pdf'],
            ['label' => 'Empty field', 'type' => 'text', 'value' => ''],
        ];

        foreach ($fields as $order => $field) {
            $fieldId = DB::table('custom_fields')->insertGetId([
                'custom_field_group_id' => $groupId,
                'label' => $field['label'],
                'type' => $field['type'],
                'display_order' => $order,
            ]);
            DB::table('custom_fields_data')->insert([
                'custom_field_id' => $fieldId, 'model' => Lead::CUSTOM_FIELD_MODEL, 'model_id' => 16,
                'value' => $field['value'], 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        $details = app(LeadSummaryInputBuilder::class)->build($lead)['sections']['lead_details'];

        $this->assertSame([
            ['label' => 'Budget', 'value' => '€200–250K'],
            ['label' => 'Property types', 'value' => 'Apartment, Villa'],
        ], $details);
    }

    public function test_deals_drop_their_name_and_carry_buying_intent(): void
    {
        $lead = $this->makeLeadForBuilder(['id' => 17, 'client_name' => 'Jane Doe']);
        $dealId = DB::table('deals')->insertGetId(['lead_id' => 17, 'created_at' => now(), 'updated_at' => now()]);
        DB::table('hibarr_deal_custom_fields')->insert([
            'deal_id' => $dealId,
            'interested_in' => 'Sea-view apartment',
            'budget_range' => 'EUR 200-250K',
            'purchase_timeline' => '3-6 months',
            'message' => 'Please call Jane Doe on +90 533 877 3001',
            'strategy_meeting_booked' => true,
            'downpayment_paid' => false,
            'inspection_trip_date' => '2026-11-20',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $deals = $this->makeBuilderWithDealSnapshot([
            'deal_id' => (string) $dealId,
            'deal_name' => 'Riverside Villas - Jane Doe',
            'stage_label' => 'Consultation',
            'value' => 225000.0,
            'currency' => 'EUR',
            'risk_level' => 'medium',
            'status_line' => 'Jane Doe has had no contact since the call.',
            'next_step_label' => 'Call Jane Doe',
            'is_stale' => true,
            'source' => 'ai',
        ])->build($lead)['sections']['deals'];

        $this->assertCount(1, $deals);
        $deal = $deals[0];

        $this->assertArrayNotHasKey('deal_name', $deal);
        $this->assertArrayNotHasKey('is_stale', $deal);
        $this->assertArrayNotHasKey('source', $deal);
        $this->assertSame('medium', $deal['risk_level']);
        $this->assertSame('[name] has had no contact since the call.', $deal['status_line']);
        $this->assertSame('Call [name]', $deal['next_step_label']);
        $this->assertSame([
            'interested_in' => 'Sea-view apartment',
            'purchase_timeline' => '3-6 months',
            'budget_range' => 'EUR 200-250K',
            'message' => 'Please call [name] on [phone]',
            'strategy_meeting_booked' => true,
            'inspection_trip_date' => '2026-11-20',
        ], $deal['buying_intent']);
    }

    public function test_marketing_carries_campaign_and_engagement_but_no_tracking_identifiers(): void
    {
        $lead = $this->makeLeadForBuilder(['id' => 18, 'client_name' => 'Sam Lead'], [
            'marketing' => new LeadMarketing([
                'utm_source' => 'google',
                'utm_campaign' => 'Antalya Off-Plan Q3',
                'has_registered_for_the_webinar' => true,
                'ip_address' => '203.0.113.9',
                'facebook_click_id' => 'fb.1.123.456',
                'user_agent' => 'Mozilla/5.0',
            ]),
        ]);

        $marketing = app(LeadSummaryInputBuilder::class)->build($lead)['sections']['marketing'];

        $this->assertSame('Antalya Off-Plan Q3', $marketing['campaign']);
        $this->assertSame(['registered for webinar'], $marketing['engagement']);
        $this->assertStringNotContainsString('203.0.113.9', json_encode($marketing));
        $this->assertStringNotContainsString('fb.1.123.456', json_encode($marketing));
        $this->assertStringNotContainsString('Mozilla', json_encode($marketing));
    }

    public function test_input_hash_changes_when_qualification_answers_or_custom_fields_change(): void
    {
        $lead = $this->makeLeadForBuilder(['id' => 19, 'client_name' => 'Sam Lead']);
        $builder = app(LeadSummaryInputBuilder::class);

        $baseline = $builder->inputHash($lead);
        $this->assertSame($baseline, $builder->inputHash($lead), 'hash must be deterministic');

        $callId = DB::table('lead_qualifications')->insertGetId([
            'lead_id' => 19, 'status' => 'completed', 'started_at' => now(),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $afterCall = $builder->inputHash($lead);
        $this->assertNotSame($baseline, $afterCall, 'a new qualification call must make the summary stale');

        DB::table('lead_qualification_answers')->insert([
            'lead_qualification_id' => $callId, 'segment_key' => 'q', 'answer_text' => 'x',
            'created_at' => Carbon::now()->addMinute(), 'updated_at' => Carbon::now()->addMinute(),
        ]);
        $afterAnswer = $builder->inputHash($lead);
        $this->assertNotSame($afterCall, $afterAnswer, 'a new answer must make the summary stale');

        $groupId = DB::table('custom_field_groups')->insertGetId(['model' => Lead::CUSTOM_FIELD_MODEL]);
        $fieldId = DB::table('custom_fields')->insertGetId(['custom_field_group_id' => $groupId, 'label' => 'Budget']);
        DB::table('custom_fields_data')->insert([
            'custom_field_id' => $fieldId, 'model' => Lead::CUSTOM_FIELD_MODEL, 'model_id' => 19, 'value' => '100K',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $afterField = $builder->inputHash($lead);
        $this->assertNotSame($afterAnswer, $afterField, 'a custom field change must make the summary stale');

        DB::table('custom_fields_data')->where('model_id', 19)->update(['value' => '200K']);
        $this->assertNotSame($afterField, $builder->inputHash($lead));
    }

    /**
     * Drift guard: the prompt documents the payload the builder sends. If a key is
     * added to the payload but not to the prompt, the model is being handed data it
     * was never told how to read (or vice versa) — fail loudly instead.
     */
    public function test_every_payload_key_is_documented_in_the_prompt(): void
    {
        $lead = $this->makeLeadForBuilder([
            'id' => 20,
            'client_name' => 'Jane Doe',
            'client_email' => 'jane@example.com',
            'mobile' => '+905338773001',
            'client_whatsapp' => '+905338773001',
            'client_telegram' => '@jane',
            'nationality' => 'German',
            'country' => 'Germany',
            'city' => 'Munich',
            'occupation' => 'Engineer',
            'languages' => ['German', 'English'],
            'age_range' => '31-40',
            'temperature' => 'warm',
            'note' => 'Looking for villas',
            'lead_owner' => 1,
        ], [
            'marketing' => new LeadMarketing([
                'utm_source' => 'google', 'utm_medium' => 'cpc', 'utm_campaign' => 'Q3',
                'utm_content' => 'villa-ad', 'utm_term' => 'villa antalya',
                'has_attended_the_webinar' => true, 'last_webinar_date' => Carbon::now()->subDays(5),
                'contact_score' => 40,
            ]),
        ], [
            (object) [
                'heading' => 'Send yield figures',
                'boardColumn' => (object) ['column_name' => 'To do'],
                'due_date' => Carbon::now()->addDays(2),
            ],
        ]);

        DB::table('lead_notes')->insert(['lead_id' => 20, 'details' => 'A note', 'created_at' => now(), 'updated_at' => now()]);
        DB::table('lead_follow_up')->insert([
            'lead_id' => 20, 'remark' => 'Intro call', 'next_follow_up_date' => Carbon::now()->addDays(3),
            'status' => 'scheduled', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $callId = DB::table('lead_qualifications')->insertGetId([
            'lead_id' => 20, 'template_name' => 'Buyer', 'status' => 'completed',
            'outcomes' => json_encode(['callback']), 'outcome_comment' => 'Call back Friday',
            'started_at' => now()->subDay(), 'completed_at' => now()->subDay(),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('lead_qualification_answers')->insert([
            'lead_qualification_id' => $callId, 'segment_key' => 'q', 'question_label' => 'Budget?',
            'answer_labels' => json_encode(['200K']), 'answer_text' => 'Flexible', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $groupId = DB::table('custom_field_groups')->insertGetId(['model' => Lead::CUSTOM_FIELD_MODEL]);
        $fieldId = DB::table('custom_fields')->insertGetId(['custom_field_group_id' => $groupId, 'label' => 'Purpose']);
        DB::table('custom_fields_data')->insert([
            'custom_field_id' => $fieldId, 'model' => Lead::CUSTOM_FIELD_MODEL, 'model_id' => 20, 'value' => 'Investment',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $dealId = DB::table('deals')->insertGetId(['lead_id' => 20, 'created_at' => now(), 'updated_at' => now()]);
        DB::table('hibarr_deal_custom_fields')->insert([
            'deal_id' => $dealId, 'interested_in' => 'Villa', 'motivation' => 'Investment',
            'purchase_timeline' => 'Soon', 'budget_range' => '200K', 'message' => 'Hello',
            'strategy_meeting_booked' => true, 'downpayment_paid' => true, 'inspection_trip_date' => '2026-12-01',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $payload = $this->makeBuilderWithDealSnapshot([
            'deal_id' => (string) $dealId, 'deal_name' => 'X', 'stage_label' => 'Consultation',
            'value' => 1.0, 'currency' => 'EUR', 'risk_level' => 'low', 'status_line' => 'Fine',
            'next_step_label' => 'Call',
        ])->build($lead);

        $prompt = app(EntitySummaryPromptLoader::class)->loadLeadSummaryPrompt();

        $missing = array_values(array_filter(
            array_unique($this->payloadKeys(array_diff_key($payload, ['action_taxonomy' => true]))),
            fn (string $key) => ! str_contains($prompt, '"'.$key.'"')
        ));

        $this->assertSame([], $missing, 'payload keys the prompt does not document: '.implode(', ', $missing));

        // The sections this test exists to protect must actually have been exercised.
        foreach (['profile', 'initial_message', 'qualification_calls', 'lead_details', 'notes', 'meetings', 'tasks', 'marketing', 'deals'] as $section) {
            $this->assertArrayHasKey($section, $payload['sections'], "test did not exercise section: {$section}");
        }
    }

    /**
     * @param  array<mixed>  $data
     * @return list<string>
     */
    private function payloadKeys(array $data): array
    {
        $keys = [];

        foreach ($data as $key => $value) {
            if (is_string($key)) {
                $keys[] = $key;
            }

            if (is_array($value)) {
                $keys = array_merge($keys, $this->payloadKeys($value));
            }
        }

        return $keys;
    }

    /**
     * @param  array<string, mixed>  $snapshot
     */
    private function makeBuilderWithDealSnapshot(array $snapshot): LeadSummaryInputBuilder
    {
        $snapshots = Mockery::mock(DealSummarySnapshotService::class);
        $snapshots->shouldReceive('getOrGenerate')->andReturn($snapshot);

        return new LeadSummaryInputBuilder($snapshots);
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<string, mixed>  $relations
     * @param  list<object>  $tasks
     */
    private function makeLeadForBuilder(array $attributes, array $relations = [], array $tasks = []): Lead
    {
        $lead = Mockery::mock(Lead::class)->makePartial();

        $defaults = [
            'client_email' => null,
            'mobile' => null,
            'cell' => null,
            'office' => null,
            'client_whatsapp' => null,
            'client_telegram' => null,
            'gender' => null,
            'languages' => null,
            'date_of_birth' => null,
            'nationality' => null,
            'country' => null,
            'city' => null,
            'occupation' => null,
            'company_name' => null,
            'note' => null,
            'age_range' => null,
            'temperature' => null,
            'preferred_contact_times' => [],
            'preferred_contact_time' => null,
            'lead_lifecycle_status_id' => null,
            'lead_owner' => null,
            'source_id' => null,
            'category_id' => null,
        ];

        foreach (array_merge($defaults, $attributes) as $key => $value) {
            $lead->{$key} = $value;
        }

        $lead->created_at = now();
        $lead->updated_at = now();

        $lead->shouldReceive('loadMissing')->andReturnUsing(function () use ($lead, $relations) {
            $lead->setRelation('leadOwner', null);
            $lead->setRelation('leadSource', null);
            $lead->setRelation('category', null);
            $lead->setRelation('lifecycleStatus', null);
            $lead->setRelation('marketing', $relations['marketing'] ?? null);

            return $lead;
        });

        $taskQuery = Mockery::mock();
        $taskQuery->shouldReceive('with')->andReturnSelf();
        $taskQuery->shouldReceive('orderByDesc')->andReturnSelf();
        $taskQuery->shouldReceive('limit')->andReturnSelf();
        $taskQuery->shouldReceive('get')->andReturn(collect($tasks));
        $taskQuery->shouldReceive('count')->andReturn(count($tasks));
        $taskQuery->shouldReceive('max')->andReturn(null);
        $lead->shouldReceive('tasks')->andReturn($taskQuery);

        return $lead;
    }
}
