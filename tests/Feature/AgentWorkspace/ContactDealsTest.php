<?php

namespace Tests\Feature\AgentWorkspace;

use App\Models\User;
use App\Services\AgentWorkspace\ContactDeals;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * The person's deals for the contact page's second row, run against a real
 * (in-memory) database and the deal page's own view_deals check: open deals
 * first, newest first within each group, and only the deals the viewer may
 * open.
 */
class ContactDealsTest extends TestCase
{
    private const TABLES = ['deals', 'pipeline_stages', 'lead_pipelines'];

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        foreach (self::TABLES as $table) {
            Schema::dropIfExists($table);
        }
        Schema::create('pipeline_stages', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
            $table->string('label_color')->nullable();
        });
        Schema::create('lead_pipelines', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
        });
        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('pipeline_stage_id')->nullable();
            $table->unsignedInteger('lead_pipeline_id')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->string('outcome_status')->nullable();
        });

        DB::table('pipeline_stages')->insert(['id' => 3, 'name' => 'Viewing', 'label_color' => '#123456']);
        DB::table('lead_pipelines')->insert(['id' => 2, 'name' => 'Sales']);
        DB::table('deals')->insert([
            ['id' => 10, 'name' => 'Won villa', 'lead_id' => 7, 'pipeline_stage_id' => null, 'lead_pipeline_id' => 2, 'added_by' => 5, 'outcome_status' => 'won'],
            ['id' => 11, 'name' => 'Old flat', 'lead_id' => 7, 'pipeline_stage_id' => 3, 'lead_pipeline_id' => 2, 'added_by' => 9, 'outcome_status' => null],
            ['id' => 12, 'name' => 'New flat', 'lead_id' => 7, 'pipeline_stage_id' => 3, 'lead_pipeline_id' => 2, 'added_by' => 5, 'outcome_status' => null],
            ['id' => 13, 'name' => 'Lost plot', 'lead_id' => 7, 'pipeline_stage_id' => null, 'lead_pipeline_id' => null, 'added_by' => 5, 'outcome_status' => 'lost'],
            ['id' => 20, 'name' => 'Someone else', 'lead_id' => 8, 'pipeline_stage_id' => 3, 'lead_pipeline_id' => 2, 'added_by' => 5, 'outcome_status' => null],
        ]);
    }

    protected function tearDown(): void
    {
        foreach (self::TABLES as $table) {
            Schema::dropIfExists($table);
        }
        parent::tearDown();
    }

    public function test_open_deals_come_first_then_newest_first(): void
    {
        $deals = (new ContactDeals)->forLead(7, $this->viewer('all'));

        $this->assertSame([12, 11, 13, 10], array_column($deals, 'id'));
        $this->assertSame([
            'id' => 12,
            'name' => 'New flat',
            'stage' => 'Viewing',
            'stage_color' => '#123456',
            'pipeline' => 'Sales',
            'outcome' => null,
        ], $deals[0]);
        $this->assertSame('lost', $deals[2]['outcome']);
        $this->assertNull($deals[2]['pipeline']);
    }

    public function test_only_the_deals_the_viewer_may_open_are_listed(): void
    {
        // "added" scope: only the deals this viewer added.
        $this->assertSame([12, 13, 10], array_column((new ContactDeals)->forLead(7, $this->viewer('added')), 'id'));
        $this->assertSame([], (new ContactDeals)->forLead(7, $this->viewer('none')));
    }

    public function test_a_person_without_deals_has_an_empty_row(): void
    {
        $this->assertSame([], (new ContactDeals)->forLead(99, $this->viewer('all')));
    }

    public function test_the_people_list_gets_each_persons_open_deals_in_one_pass(): void
    {
        $byLead = (new ContactDeals)->openForLeads([7, 8, 99], $this->viewer('all'));

        // Won and lost deals are left out; oldest open deal first.
        $this->assertSame([11, 12], array_column($byLead[7], 'id'));
        $this->assertSame(['id' => 20, 'name' => 'Someone else', 'stage' => 'Viewing', 'stage_color' => '#123456'], $byLead[8][0]);
        $this->assertArrayNotHasKey(99, $byLead);
        $this->assertSame([], (new ContactDeals)->openForLeads([], $this->viewer('all')));
    }

    public function test_the_people_list_only_shows_deals_the_viewer_may_open(): void
    {
        $byLead = (new ContactDeals)->openForLeads([7], $this->viewer('added'));

        $this->assertSame([12], array_column($byLead[7], 'id'));
        $this->assertSame([], (new ContactDeals)->openForLeads([7], $this->viewer('none')));
    }

    /** A viewer (id 5) whose view_deals permission has the given scope. */
    private function viewer(string $scope): User
    {
        $user = new class extends User
        {
            public string $scope = 'none';

            public function permission($permission)
            {
                return $permission === 'view_deals' ? $this->scope : 'none';
            }
        };
        $user->scope = $scope;
        $user->id = 5;

        return $user;
    }
}
