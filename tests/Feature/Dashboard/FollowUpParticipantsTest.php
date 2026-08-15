<?php

namespace Tests\Feature\Dashboard;

use App\Models\DealFollowUp;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * DealFollowUp::attachParticipantUsers hydrates the participants JSON for the
 * meeting modals.
 *
 * The ids in that column are not reliably integers — scopeVisibleToUser has to
 * check for both int and string forms, which is the tell that both are in the
 * data. A hydration that only matches ints silently drops every participant on
 * the affected rows and the modal renders an empty attendee list.
 */
class FollowUpParticipantsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_string_and_integer_participant_ids_both_resolve(): void
    {
        $this->makeUser(7, 'Kiyana Nazar');
        $this->makeUser(8, 'Emman Obadi');

        $this->makeFollowUp(1, [7, '8']);

        $followUps = DealFollowUp::all();
        DealFollowUp::attachParticipantUsers($followUps);

        $names = collect($followUps->first()->participant_users)->pluck('name')->all();

        $this->assertSame(['Kiyana Nazar', 'Emman Obadi'], $names);
    }

    public function test_deleted_or_missing_participants_are_dropped_not_nulled(): void
    {
        $this->makeUser(7, 'Kiyana Nazar');

        // 99 does not exist — a null in this array crashes the attendee list.
        $this->makeFollowUp(1, [7, 99]);

        $followUps = DealFollowUp::all();
        DealFollowUp::attachParticipantUsers($followUps);

        $participants = $followUps->first()->participant_users;

        $this->assertCount(1, $participants);
        $this->assertNotContains(null, $participants);
    }

    public function test_empty_participants_yield_an_empty_array_and_a_duration(): void
    {
        $this->makeFollowUp(1, null);

        $followUps = DealFollowUp::all();
        DealFollowUp::attachParticipantUsers($followUps);

        $this->assertSame([], $followUps->first()->participant_users);
        $this->assertSame(
            DealFollowUp::DEFAULT_DURATION_MINUTES,
            $followUps->first()->effective_duration,
        );
    }

    public function test_participants_are_resolved_in_one_query_for_the_collection(): void
    {
        $this->makeUser(7, 'Kiyana Nazar');
        $this->makeUser(8, 'Emman Obadi');

        foreach (range(1, 5) as $id) {
            $this->makeFollowUp($id, [7, 8]);
        }

        $followUps = DealFollowUp::all();

        DB::enableQueryLog();
        DealFollowUp::attachParticipantUsers($followUps);
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertCount(1, $queries, 'Participant hydration went per-row');
    }

    public function test_a_deactivated_participant_still_appears(): void
    {
        $this->makeUser(7, 'Kiyana Nazar');
        $this->makeUser(8, 'Left The Company', status: 'deactive');

        $this->makeFollowUp(1, [7, 8]);

        $followUps = DealFollowUp::all();
        DealFollowUp::attachParticipantUsers($followUps);

        $this->assertCount(
            2,
            $followUps->first()->participant_users,
            'ActiveScope silently removed a past attendee',
        );
    }

    private function makeUser(int $id, string $name, string $status = 'active'): void
    {
        DB::table('users')->insert([
            'id' => $id,
            'name' => $name,
            'status' => $status,
            'email' => strtolower(str_replace(' ', '.', $name)).'@example.test',
        ]);
    }

    private function makeFollowUp(int $id, ?array $participants): void
    {
        DB::table('lead_follow_up')->insert([
            'id' => $id,
            'company_id' => 1,
            'participants' => is_null($participants) ? null : json_encode($participants),
            'status' => 'scheduled',
            'next_follow_up_date' => '2026-08-10 10:00:00',
        ]);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('lead_follow_up');
        Schema::dropIfExists('users');
    }

    private function createMinimalSchema(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('image')->nullable();
            // ActiveScope filters on this; without it every query 500s.
            $table->string('status')->default('active');
        });

        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('deal_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->text('participants')->nullable();
            $table->string('status')->nullable();
            $table->integer('duration')->nullable();
            $table->dateTime('next_follow_up_date')->nullable();
            $table->timestamps();
        });
    }
}
