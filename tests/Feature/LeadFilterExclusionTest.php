<?php

namespace Tests\Feature;

use App\Models\Lead;
use App\Services\LeadService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use ReflectionMethod;
use Tests\TestCase;

/**
 * "Is not", "Is empty" and "Has any" on the Leads filters, sent as `<key>_mode`.
 *
 * The thing every one of these guards against is SQL's three-valued logic: a
 * lead with no owner is "not in" a list of owners, but `NOT IN` silently drops
 * NULLs, so a naive exclusion hides exactly the leads people ask for.
 */
class LeadFilterExclusionTest extends TestCase
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

        DB::table('companies')->insert([
            'id' => $this->companyId,
            'company_name' => 'Test Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    // ── scalar columns ──────────────────────────────────────────────────

    public function test_not_in_keeps_leads_that_have_no_value(): void
    {
        $facebook = $this->insertLead(['source_id' => 1]);
        $google = $this->insertLead(['source_id' => 2]);
        $none = $this->insertLead(['source_id' => null]);

        $this->assertSame(
            $this->sorted([$google, $none]),
            $this->sorted($this->ids(['lead_source' => '1', 'lead_source_mode' => 'not_in']))
        );
        $this->assertNotContains($facebook, $this->ids(['lead_source' => '1', 'lead_source_mode' => 'not_in']));
    }

    public function test_empty_and_any_on_the_lead_owner(): void
    {
        $owned = $this->insertLead(['lead_owner' => 7]);
        $unowned = $this->insertLead(['lead_owner' => null]);

        $this->assertSame([$unowned], $this->ids(['lead_owner_id_mode' => 'empty']));
        $this->assertSame([$owned], $this->ids(['lead_owner_id_mode' => 'any']));
    }

    public function test_empty_and_any_ignore_values_sent_alongside_them(): void
    {
        $owned = $this->insertLead(['lead_owner' => 7]);
        $unowned = $this->insertLead(['lead_owner' => null]);

        $this->assertSame([$unowned], $this->ids(['lead_owner_id' => '7', 'lead_owner_id_mode' => 'empty']));
        $this->assertSame([$owned], $this->ids(['lead_owner_id' => '99', 'lead_owner_id_mode' => 'any']));
    }

    public function test_not_in_without_values_filters_nothing(): void
    {
        $a = $this->insertLead(['lead_owner' => 7]);
        $b = $this->insertLead(['lead_owner' => null]);

        $this->assertSame($this->sorted([$a, $b]), $this->sorted($this->ids(['lead_owner_id_mode' => 'not_in'])));
    }

    public function test_an_unknown_mode_is_ignored_and_the_values_apply_as_before(): void
    {
        $a = $this->insertLead(['lead_owner' => 7]);
        $this->insertLead(['lead_owner' => 8]);

        $this->assertSame([$a], $this->ids(['lead_owner_id' => '7', 'lead_owner_id_mode' => 'drop table']));
    }

    public function test_text_columns_treat_a_blank_string_as_empty(): void
    {
        $blank = $this->insertLead(['gender' => '']);
        $null = $this->insertLead(['gender' => null]);
        $female = $this->insertLead(['gender' => 'female']);

        $this->assertSame($this->sorted([$blank, $null]), $this->sorted($this->ids(['gender_mode' => 'empty'])));
        $this->assertSame([$female], $this->ids(['gender_mode' => 'any']));
    }

    public function test_not_in_on_a_text_column_keeps_blank_and_null(): void
    {
        $cold = $this->insertLead(['temperature' => 'cold']);
        $hot = $this->insertLead(['temperature' => 'hot']);
        $none = $this->insertLead(['temperature' => null]);

        $ids = $this->ids(['temperature' => 'cold', 'temperature_mode' => 'not_in']);

        $this->assertSame($this->sorted([$hot, $none]), $this->sorted($ids));
        $this->assertNotContains($cold, $ids);
    }

    public function test_referrer_has_any_means_partner_referred(): void
    {
        $referred = $this->insertLead(['referred_by_agent_id' => 3]);
        $this->insertLead(['referred_by_agent_id' => null]);

        $this->assertSame([$referred], $this->ids(['referred_by_agent_id_mode' => 'any']));
    }

    // ── categories (scalar column + pivot) ───────────────────────────────

    public function test_category_empty_needs_no_scalar_category_and_no_pivot_row(): void
    {
        $catA = $this->insertCategory('A');
        $scalar = $this->insertLead(['category_id' => $catA]);
        $pivot = $this->insertLead();
        $this->attachCategory($pivot, $catA);
        $bare = $this->insertLead();

        $this->assertSame([$bare], $this->ids(['category_id_mode' => 'empty']));
        $this->assertSame($this->sorted([$scalar, $pivot]), $this->sorted($this->ids(['category_id_mode' => 'any'])));
    }

    public function test_category_not_in_excludes_a_match_through_either_place_and_keeps_uncategorised(): void
    {
        $catA = $this->insertCategory('A');
        $catB = $this->insertCategory('B');

        $viaScalar = $this->insertLead(['category_id' => $catA]);
        $viaPivot = $this->insertLead();
        $this->attachCategory($viaPivot, $catA);
        $other = $this->insertLead(['category_id' => $catB]);
        $bare = $this->insertLead();

        $ids = $this->ids(['category_id' => (string) $catA, 'category_id_mode' => 'not_in']);

        $this->assertSame($this->sorted([$other, $bare]), $this->sorted($ids));
        $this->assertNotContains($viaScalar, $ids);
        $this->assertNotContains($viaPivot, $ids);
    }

    // ── UTM (first touch + later touches) ────────────────────────────────

    public function test_utm_not_in_excludes_anyone_who_ever_touched_through_that_value(): void
    {
        // First touch google, came back later through facebook.
        $returning = $this->insertLead();
        $this->insertMarketing($returning, ['utm_source' => 'google']);
        $this->insertUtmTouch($returning, ['utm_source' => 'facebook']);

        $googleOnly = $this->insertLead();
        $this->insertMarketing($googleOnly, ['utm_source' => 'google']);

        $untracked = $this->insertLead();

        $ids = $this->ids(['utm_source' => 'facebook', 'utm_source_mode' => 'not_in']);

        $this->assertSame($this->sorted([$googleOnly, $untracked]), $this->sorted($ids));
        $this->assertNotContains($returning, $ids);
    }

    public function test_utm_empty_and_any(): void
    {
        $tracked = $this->insertLead();
        $this->insertMarketing($tracked, ['utm_campaign' => 'spring']);

        $laterOnly = $this->insertLead();
        $this->insertMarketing($laterOnly, ['utm_campaign' => null]);
        $this->insertUtmTouch($laterOnly, ['utm_campaign' => 'summer']);

        $blank = $this->insertLead();
        $this->insertMarketing($blank, ['utm_campaign' => '']);

        $noRow = $this->insertLead();

        $this->assertSame(
            $this->sorted([$blank, $noRow]),
            $this->sorted($this->ids(['utm_campaign_mode' => 'empty']))
        );
        $this->assertSame(
            $this->sorted([$tracked, $laterOnly]),
            $this->sorted($this->ids(['utm_campaign_mode' => 'any']))
        );
    }

    // ── marketing flags and contact score ────────────────────────────────

    public function test_flag_unknown_is_the_lead_that_has_no_marketing_record(): void
    {
        $yes = $this->insertLead();
        $this->insertMarketing($yes, ['has_attended_the_webinar' => true]);
        $no = $this->insertLead();
        $this->insertMarketing($no, ['has_attended_the_webinar' => false]);
        $unknown = $this->insertLead();

        $this->assertSame([$unknown], $this->ids(['has_attended_the_webinar' => 'unknown']));
        // Yes / No keep meaning what they did.
        $this->assertSame([$yes], $this->ids(['has_attended_the_webinar' => '1']));
    }

    public function test_contact_score_empty_means_no_marketing_row_or_no_score(): void
    {
        $scored = $this->insertLead();
        $this->insertMarketing($scored, ['contact_score' => 50]);
        $zero = $this->insertLead();
        $this->insertMarketing($zero, ['contact_score' => 0]);
        $nullScore = $this->insertLead();
        $this->insertMarketing($nullScore, ['contact_score' => null]);
        $noRow = $this->insertLead();

        $ids = $this->ids(['contact_score_mode' => 'empty']);

        $this->assertSame($this->sorted([$nullScore, $noRow]), $this->sorted($ids));
        $this->assertNotContains($zero, $ids, 'A score of 0 is a real score.');
    }

    public function test_contact_score_empty_replaces_a_range_sent_with_it(): void
    {
        $scored = $this->insertLead();
        $this->insertMarketing($scored, ['contact_score' => 50]);
        $noRow = $this->insertLead();

        $this->assertSame(
            [$noRow],
            $this->ids(['contact_score_mode' => 'empty', 'min_contact_score' => '20'])
        );
    }

    // ── qualification ────────────────────────────────────────────────────

    public function test_qualification_empty_without_a_segment_means_never_qualified(): void
    {
        $qualified = $this->insertLead();
        $this->insertQualificationAnswer($qualified, 'budget', ['high']);
        $never = $this->insertLead();

        $this->assertSame([$never], $this->ids(['qualification_answer_values_mode' => 'empty']));
    }

    public function test_qualification_empty_with_a_segment_means_no_answer_to_that_segment(): void
    {
        $answered = $this->insertLead();
        $this->insertQualificationAnswer($answered, 'budget', ['high']);
        $otherSegment = $this->insertLead();
        $this->insertQualificationAnswer($otherSegment, 'timeline', ['soon']);
        $never = $this->insertLead();

        $ids = $this->ids([
            'qualification_segment_key' => 'budget',
            'qualification_answer_values_mode' => 'empty',
        ]);

        $this->assertSame($this->sorted([$otherSegment, $never]), $this->sorted($ids));
    }

    public function test_qualification_not_in_excludes_any_listed_answer_and_keeps_the_unanswered(): void
    {
        $high = $this->insertLead();
        $this->insertQualificationAnswer($high, 'budget', ['high']);
        $cash = $this->insertLead();
        $this->insertQualificationAnswer($cash, 'budget', ['cash']);
        $low = $this->insertLead();
        $this->insertQualificationAnswer($low, 'budget', ['low']);
        $never = $this->insertLead();

        $ids = $this->ids([
            'qualification_segment_key' => 'budget',
            'qualification_answer_values' => 'high,cash',
            'qualification_answer_values_mode' => 'not_in',
        ]);

        $this->assertSame($this->sorted([$low, $never]), $this->sorted($ids));
    }

    // ── languages (JSON list) ────────────────────────────────────────────

    public function test_language_empty_any_and_not_in(): void
    {
        $english = $this->insertLead(['languages' => json_encode(['en'])]);
        $both = $this->insertLead(['languages' => json_encode(['en', 'de'])]);
        $emptyList = $this->insertLead(['languages' => json_encode([])]);
        $none = $this->insertLead(['languages' => null]);

        $this->assertSame($this->sorted([$emptyList, $none]), $this->sorted($this->ids(['language_mode' => 'empty'])));
        $this->assertSame($this->sorted([$english, $both]), $this->sorted($this->ids(['language_mode' => 'any'])));

        $ids = $this->ids(['language' => 'de', 'language_mode' => 'not_in']);
        $this->assertSame($this->sorted([$english, $emptyList, $none]), $this->sorted($ids));
        $this->assertNotContains($both, $ids);
    }

    // ── custom fields ────────────────────────────────────────────────────

    public function test_custom_field_not_in_empty_and_any(): void
    {
        $fieldId = $this->insertCustomField('select', ['Low', 'High']);

        $high = $this->insertLead();
        $this->setCustomFieldValue($fieldId, $high, 'High');
        $low = $this->insertLead();
        $this->setCustomFieldValue($fieldId, $low, 'Low');
        $blank = $this->insertLead();
        $this->setCustomFieldValue($fieldId, $blank, '');
        $unset = $this->insertLead();

        $key = "cf_{$fieldId}";

        $this->assertSame([$high], $this->ids([$key => 'High']));
        $this->assertSame(
            $this->sorted([$low, $blank, $unset]),
            $this->sorted($this->ids([$key => 'High', "{$key}_mode" => 'not_in']))
        );
        $this->assertSame($this->sorted([$blank, $unset]), $this->sorted($this->ids(["{$key}_mode" => 'empty'])));
        $this->assertSame($this->sorted([$high, $low]), $this->sorted($this->ids(["{$key}_mode" => 'any'])));
    }

    public function test_a_cleared_multiselect_custom_field_counts_as_empty(): void
    {
        $fieldId = $this->insertCustomField('multiselect', ['a', 'b']);

        $chosen = $this->insertLead();
        $this->setCustomFieldValue($fieldId, $chosen, json_encode(['a']));
        $cleared = $this->insertLead();
        $this->setCustomFieldValue($fieldId, $cleared, '[]');

        $this->assertSame([$cleared], $this->ids(["cf_{$fieldId}_mode" => 'empty']));
        $this->assertSame([$chosen], $this->ids(["cf_{$fieldId}_mode" => 'any']));
    }

    // ── next action: everything except overdue ───────────────────────────

    public function test_next_action_not_overdue_is_everything_but_overdue(): void
    {
        // user() / company() read the session first; the next-action SQL only
        // asks the user for an id and a permission level.
        session([
            'company' => (object) ['id' => $this->companyId],
            'user' => new class
            {
                public int $id = 1;

                public function permission(string $name): string
                {
                    return 'all';
                }
            },
        ]);

        $overdue = $this->insertLead();
        $this->insertOpenTask($overdue, now()->utc()->subDay());
        $upcoming = $this->insertLead();
        $this->insertOpenTask($upcoming, now()->utc()->addDays(3));
        $viaMeeting = $this->insertLead();
        DB::table('lead_follow_up')->insert([
            'lead_id' => $viaMeeting,
            'status' => 'scheduled',
            'next_follow_up_date' => now()->utc()->addDay()->format('Y-m-d H:i:s'),
        ]);
        $nothing = $this->insertLead();

        $this->assertSame([$overdue], $this->ids(['next_action' => 'overdue']));
        $this->assertSame(
            $this->sorted([$upcoming, $viaMeeting, $nothing]),
            $this->sorted($this->ids(['next_action' => 'not_overdue']))
        );
    }

    // ── whitelist ────────────────────────────────────────────────────────

    public function test_mode_params_are_part_of_the_whitelist_and_survive_the_url_echo(): void
    {
        $request = Request::create('/lead-contact', 'GET', [
            'lead_owner_id_mode' => 'empty',
            'cf_12_mode' => 'not_in',
            'cf_12' => 'a,b',
            'per_page' => 5000,
        ]);

        $this->assertSame(
            ['lead_owner_id_mode' => 'empty', 'cf_12_mode' => 'not_in', 'cf_12' => 'a,b'],
            LeadService::filtersFromRequest($request)
        );
    }

    public function test_every_mode_filter_key_is_a_filter_the_service_reads(): void
    {
        $source = file_get_contents(__DIR__.'/../../app/Services/LeadService.php');

        foreach (LeadService::MODE_FILTER_KEYS as $key) {
            $this->assertStringContainsString("'{$key}'", $source);
        }
    }

    // ── harness ──────────────────────────────────────────────────────────

    /**
     * @param  array<string, mixed>  $params
     * @return array<int, int>
     */
    private function ids(array $params): array
    {
        $request = Request::create('/lead-contact', 'GET', $params);

        $applyFilters = new ReflectionMethod(LeadService::class, 'applyFilters');
        $applyFilters->setAccessible(true);

        $query = Lead::query()->select('leads.*');
        $applyFilters->invoke(app(LeadService::class), $query, $request);

        return $query->pluck('leads.id')->map(fn ($id) => (int) $id)->all();
    }

    /** @param  array<int, int>  $ids */
    private function sorted(array $ids): array
    {
        sort($ids);

        return $ids;
    }

    /** @param  list<string>  $options */
    private function insertCustomField(string $type, array $options): int
    {
        $groupId = (int) DB::table('custom_field_groups')->insertGetId([
            'company_id' => $this->companyId,
            'name' => 'Leads',
            'model' => Lead::CUSTOM_FIELD_MODEL,
        ]);

        return (int) DB::table('custom_fields')->insertGetId([
            'company_id' => $this->companyId,
            'custom_field_group_id' => $groupId,
            'label' => 'Budget',
            'name' => 'budget',
            'type' => $type,
            'values' => json_encode($options),
        ]);
    }

    private function setCustomFieldValue(int $fieldId, int $leadId, string $value): void
    {
        DB::table('custom_fields_data')->insert([
            'custom_field_id' => $fieldId,
            'model' => Lead::CUSTOM_FIELD_MODEL,
            'model_id' => $leadId,
            'value' => $value,
        ]);
    }

    private function insertOpenTask(int $leadId, \DateTimeInterface $due): void
    {
        $taskId = (int) DB::table('tasks')->insertGetId(['due_date' => $due->format('Y-m-d H:i:s')]);
        DB::table('taskables')->insert([
            'task_id' => $taskId,
            'taskable_id' => $leadId,
            'taskable_type' => (new Lead)->getMorphClass(),
        ]);
    }

    private function insertCategory(string $name): int
    {
        return (int) DB::table('lead_category')->insertGetId([
            'category_name' => $name,
            'company_id' => $this->companyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function attachCategory(int $leadId, int $categoryId): void
    {
        DB::table('lead_lead_category')->insert([
            'lead_id' => $leadId,
            'lead_category_id' => $categoryId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** @param  list<string>  $values */
    private function insertQualificationAnswer(int $leadId, string $segmentKey, array $values): void
    {
        $qualificationId = DB::table('lead_qualifications')->insertGetId([
            'lead_id' => $leadId,
            'started_at' => now(),
        ]);

        DB::table('lead_qualification_answers')->insert([
            'lead_qualification_id' => $qualificationId,
            'segment_key' => $segmentKey,
            'answer_values' => json_encode($values),
        ]);
    }

    /** @param  array<string, mixed>  $attributes */
    private function insertMarketing(int $leadId, array $attributes): void
    {
        DB::table('lead_marketing')->insert(array_merge([
            'lead_id' => $leadId,
            'has_joined_the_facebook_group' => false,
            'has_registered_for_the_webinar' => false,
            'has_attended_the_webinar' => false,
            'has_joined_the_whatsapp_group' => false,
            'contact_score' => null,
            'utm_source' => null,
            'utm_medium' => null,
            'utm_campaign' => null,
            'utm_content' => null,
            'utm_term' => null,
            'utm_audience' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }

    /** @param  array<string, mixed>  $attributes */
    private function insertUtmTouch(int $leadId, array $attributes): void
    {
        DB::table('lead_utm_touches')->insert(array_merge([
            'lead_id' => $leadId,
            'is_first_touch' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }

    /** @param  array<string, mixed>  $attributes */
    private function insertLead(array $attributes = []): int
    {
        return (int) DB::table('leads')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'client_name' => 'Test Lead',
            'gender' => null,
            'temperature' => null,
            'category_id' => null,
            'lead_owner' => null,
            'added_by' => null,
            'source_id' => null,
            'referred_by_agent_id' => null,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }

    private function resetSchema(): void
    {
        foreach ([
            'lead_qualification_answers', 'lead_qualifications', 'lead_utm_touches', 'lead_marketing',
            'lead_lead_category', 'lead_category', 'custom_fields_data', 'custom_fields', 'custom_field_groups',
            'lead_follow_up', 'taskables', 'tasks', 'taskboard_columns', 'leads', 'companies',
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
            $table->unsignedInteger('client_id')->nullable();
            $table->string('client_name');
            $table->string('gender')->nullable();
            $table->string('temperature')->nullable();
            $table->string('preferred_contact_time')->nullable();
            $table->string('age_range')->nullable();
            $table->string('nationality')->nullable();
            $table->string('country')->nullable();
            $table->unsignedInteger('category_id')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('source_id')->nullable();
            $table->unsignedInteger('lead_origin_id')->nullable();
            $table->unsignedInteger('lead_lifecycle_status_id')->nullable();
            $table->unsignedInteger('referred_by_agent_id')->nullable();
            $table->unsignedInteger('merged_into_lead_id')->nullable();
            $table->json('languages')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('custom_field_groups', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('model')->nullable();
            $table->timestamps();
        });

        Schema::create('custom_fields', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('custom_field_group_id')->nullable();
            $table->string('label')->nullable();
            $table->string('name')->nullable();
            $table->string('type')->nullable();
            $table->text('values')->nullable();
            $table->string('required')->default('no');
            $table->timestamps();
        });

        Schema::create('custom_fields_data', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('custom_field_id');
            $table->string('model');
            $table->unsignedInteger('model_id');
            $table->text('value')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id');
            $table->string('status')->default('scheduled');
            $table->dateTime('next_follow_up_date')->nullable();
            $table->unsignedInteger('added_by')->nullable();
        });

        Schema::create('tasks', function (Blueprint $table) {
            $table->increments('id');
            $table->dateTime('due_date')->nullable();
            $table->unsignedInteger('board_column_id')->nullable();
            $table->softDeletes();
        });

        Schema::create('taskables', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('task_id');
            $table->unsignedInteger('taskable_id');
            $table->string('taskable_type');
        });

        Schema::create('taskboard_columns', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('slug')->nullable();
            $table->string('column_name')->nullable();
            $table->integer('priority')->default(1);
            $table->string('label_color')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_category', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('category_name');
            $table->timestamps();
        });

        Schema::create('lead_lead_category', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id');
            $table->unsignedInteger('lead_category_id');
            $table->timestamps();
        });

        Schema::create('lead_qualifications', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id');
            $table->timestamp('started_at')->nullable();
        });

        Schema::create('lead_qualification_answers', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_qualification_id');
            $table->string('segment_key');
            $table->json('answer_values')->nullable();
        });

        Schema::create('lead_utm_touches', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('lead_id');
            $table->string('utm_source')->nullable();
            $table->string('utm_medium')->nullable();
            $table->string('utm_campaign')->nullable();
            $table->string('utm_content')->nullable();
            $table->string('utm_term')->nullable();
            $table->string('utm_audience')->nullable();
            $table->string('origin', 50)->nullable();
            $table->boolean('is_first_touch')->default(false);
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
            $table->boolean('has_attended_the_webinar')->default(false);
            $table->integer('contact_score')->nullable();
            $table->timestamps();
        });
    }
}
