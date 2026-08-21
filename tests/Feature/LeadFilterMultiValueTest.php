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

class LeadFilterMultiValueTest extends TestCase
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
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_multiselect_filter_matches_any_of_the_comma_joined_values(): void
    {
        $hotId = $this->insertLead(['client_name' => 'Hot Lead', 'temperature' => 'hot']);
        $coldId = $this->insertLead(['client_name' => 'Cold Lead', 'temperature' => 'cold']);
        $this->insertLead(['client_name' => 'Warm Lead', 'temperature' => 'warm']);

        $ids = $this->filteredLeadIds(['temperature' => 'hot,cold']);

        sort($ids);
        $expected = [$hotId, $coldId];
        sort($expected);
        $this->assertSame($expected, $ids);
    }

    public function test_category_filter_matches_scalar_or_pivot_categories_across_multiple_ids(): void
    {
        $catA = DB::table('lead_category')->insertGetId([
            'category_name' => 'A',
            'company_id' => $this->companyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $catB = DB::table('lead_category')->insertGetId([
            'category_name' => 'B',
            'company_id' => $this->companyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $catC = DB::table('lead_category')->insertGetId([
            'category_name' => 'C',
            'company_id' => $this->companyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $scalarMatch = $this->insertLead(['client_name' => 'Scalar', 'category_id' => $catA]);
        $pivotMatch = $this->insertLead(['client_name' => 'Pivot']);
        DB::table('lead_lead_category')->insert([
            'lead_id' => $pivotMatch,
            'lead_category_id' => $catB,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->insertLead(['client_name' => 'No match', 'category_id' => $catC]);

        $ids = $this->filteredLeadIds(['category_id' => "{$catA},{$catB}"]);

        sort($ids);
        $expected = [$scalarMatch, $pivotMatch];
        sort($expected);
        $this->assertSame($expected, $ids);
    }

    public function test_marketing_boolean_yes_only_matches_explicit_true(): void
    {
        $joinedId = $this->insertLead(['client_name' => 'Joined']);
        $this->insertMarketing($joinedId, ['has_joined_the_facebook_group' => true]);

        $notJoinedId = $this->insertLead(['client_name' => 'Not joined']);
        $this->insertMarketing($notJoinedId, ['has_joined_the_facebook_group' => false]);

        $this->insertLead(['client_name' => 'No marketing row']);

        $ids = $this->filteredLeadIds(['has_joined_the_facebook_group' => '1']);

        $this->assertSame([$joinedId], $ids);
    }

    public function test_marketing_boolean_no_includes_explicit_false_and_missing_row(): void
    {
        $joinedId = $this->insertLead(['client_name' => 'Joined']);
        $this->insertMarketing($joinedId, ['has_joined_the_facebook_group' => true]);

        $explicitFalseId = $this->insertLead(['client_name' => 'Explicit false']);
        $this->insertMarketing($explicitFalseId, ['has_joined_the_facebook_group' => false]);

        $noRowId = $this->insertLead(['client_name' => 'No marketing row']);

        $ids = $this->filteredLeadIds(['has_joined_the_facebook_group' => '0']);

        sort($ids);
        $expected = [$explicitFalseId, $noRowId];
        sort($expected);
        $this->assertSame($expected, $ids);
    }

    public function test_contact_score_range_filters_leads_with_marketing_score_in_range(): void
    {
        $inRangeId = $this->insertLead(['client_name' => 'In range']);
        $this->insertMarketing($inRangeId, ['contact_score' => 50]);

        $tooLowId = $this->insertLead(['client_name' => 'Too low']);
        $this->insertMarketing($tooLowId, ['contact_score' => 5]);

        $this->insertLead(['client_name' => 'No score']);

        $ids = $this->filteredLeadIds(['min_contact_score' => '20', 'max_contact_score' => '80']);

        $this->assertSame([$inRangeId], $ids);
    }

    public function test_utm_source_multiselect_matches_any_of_the_typed_values(): void
    {
        $googleId = $this->insertLead(['client_name' => 'Google']);
        $this->insertMarketing($googleId, ['utm_source' => 'google']);

        $facebookId = $this->insertLead(['client_name' => 'Facebook']);
        $this->insertMarketing($facebookId, ['utm_source' => 'facebook']);

        $tiktokId = $this->insertLead(['client_name' => 'TikTok']);
        $this->insertMarketing($tiktokId, ['utm_source' => 'tiktok']);

        $ids = $this->filteredLeadIds(['utm_source' => 'google,facebook']);

        sort($ids);
        $expected = [$googleId, $facebookId];
        sort($expected);
        $this->assertSame($expected, $ids);
    }

    public function test_referrer_filter_matches_any_of_the_selected_partners(): void
    {
        $partnerA = $this->insertLead(['client_name' => 'From A', 'referred_by_agent_id' => 3]);
        $partnerB = $this->insertLead(['client_name' => 'From B', 'referred_by_agent_id' => 5]);
        $this->insertLead(['client_name' => 'From C', 'referred_by_agent_id' => 9]);
        $this->insertLead(['client_name' => 'No referrer']);

        $ids = $this->filteredLeadIds(['referred_by_agent_id' => '3,5']);

        sort($ids);
        $expected = [$partnerA, $partnerB];
        sort($expected);
        $this->assertSame($expected, $ids);
    }

    public function test_referrer_filter_is_ignored_when_empty(): void
    {
        $a = $this->insertLead(['client_name' => 'A', 'referred_by_agent_id' => 3]);
        $b = $this->insertLead(['client_name' => 'B']);

        $ids = $this->filteredLeadIds(['referred_by_agent_id' => '']);

        sort($ids);
        $expected = [$a, $b];
        sort($expected);
        $this->assertSame($expected, $ids);
    }

    /**
     * @param  array<string, string>  $params
     * @return array<int, int>
     */
    private function filteredLeadIds(array $params): array
    {
        $request = Request::create('/lead-contact', 'GET', $params);

        $applyFilters = new ReflectionMethod(LeadService::class, 'applyFilters');
        $applyFilters->setAccessible(true);

        $query = Lead::query();
        $applyFilters->invoke(app(LeadService::class), $query, $request);

        return $query->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

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

    private function resetSchema(): void
    {
        Schema::dropIfExists('lead_marketing');
        Schema::dropIfExists('lead_lead_category');
        Schema::dropIfExists('lead_category');
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
            $table->string('age_range')->nullable();
            $table->string('nationality')->nullable();
            $table->string('country')->nullable();
            $table->unsignedInteger('category_id')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('source_id')->nullable();
            $table->unsignedInteger('lead_lifecycle_status_id')->nullable();
            $table->unsignedInteger('referred_by_agent_id')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->unsignedInteger('merged_into_lead_id')->nullable();
            $table->softDeletes();
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

    private function seedCompany(): void
    {
        DB::table('companies')->insert([
            'id' => $this->companyId,
            'company_name' => 'Test Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function insertLead(array $attributes): int
    {
        return (int) DB::table('leads')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'client_name' => 'Test Lead',
            'client_email' => null,
            'mobile' => null,
            'gender' => null,
            'temperature' => null,
            'age_range' => null,
            'nationality' => null,
            'country' => null,
            'category_id' => null,
            'lead_owner' => null,
            'added_by' => null,
            'source_id' => null,
            'lead_lifecycle_status_id' => null,
            'referred_by_agent_id' => null,
            'last_updated_by' => null,
            'merged_into_lead_id' => null,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }
}
