<?php

namespace Tests\Feature\Dashboard;

use App\Services\Dashboard\DashboardMetricsService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use ReflectionClass;
use ReflectionMethod;
use Tests\TestCase;

/**
 * "Meetings held" reads lead_follow_up.status from a cutover date onward, and
 * infers from the date before it.
 *
 * The inference is not laziness: until the Mark held button shipped, both
 * endpoints that could write 'completed' were broken (one wrote a column that
 * does not exist, the other had no validation and threw on lead-only rows), so
 * no historical row will ever carry it. Counting only explicit completions
 * would collapse the metric to zero overnight; ignoring status forever would
 * make the button decoration. The cutover is the only honest reading, and
 * these tests pin its boundary.
 */
class HeldMeetingsTest extends TestCase
{
    private string $cutover;

    private int $nextId = 1;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();

        $reflection = new ReflectionClass(DashboardMetricsService::class);
        $this->cutover = $reflection->getConstant('STATUS_TRUSTED_FROM');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_before_the_cutover_a_past_uncompleted_meeting_still_counts(): void
    {
        $this->meeting($this->beforeCutover(), 'scheduled');

        $this->assertSame(1, $this->heldCount());
    }

    public function test_after_the_cutover_a_past_uncompleted_meeting_does_not_count(): void
    {
        $this->meeting($this->afterCutover(), 'scheduled');

        $this->assertSame(
            0,
            $this->heldCount(),
            'Past the cutover, nobody marking it held means it did not happen',
        );
    }

    public function test_after_the_cutover_an_explicitly_completed_meeting_counts(): void
    {
        $this->meeting($this->afterCutover(), 'completed');

        $this->assertSame(1, $this->heldCount());
    }

    public function test_cancelled_never_counts_on_either_side(): void
    {
        $this->meeting($this->beforeCutover(), 'cancelled');
        $this->meeting($this->afterCutover(), 'cancelled');

        $this->assertSame(0, $this->heldCount());
    }

    public function test_a_future_meeting_never_counts(): void
    {
        $this->meeting(now()->addWeek()->toDateTimeString(), 'completed');

        $this->assertSame(
            0,
            $this->heldCount(),
            'A meeting that has not happened cannot have been held',
        );
    }

    public function test_a_meeting_with_no_date_never_counts(): void
    {
        $this->meeting(null, 'completed');

        $this->assertSame(0, $this->heldCount());
    }

    public function test_the_cutover_boundary_is_inclusive_of_the_new_rule(): void
    {
        // Exactly on the cutover the new rule applies: status is authoritative.
        $this->meeting($this->cutover.' 00:00:00', 'scheduled');

        $this->assertSame(0, $this->heldCount());
    }

    public function test_the_note_names_the_cutover_date(): void
    {
        $note = app(DashboardMetricsService::class)->meetingsHeldNote();

        $this->assertStringContainsString(
            Carbon::parse($this->cutover)->format('j M Y'),
            $note,
            'The panel note must say which side of the line it reads',
        );
    }

    private function heldCount(): int
    {
        $method = new ReflectionMethod(DashboardMetricsService::class, 'heldMeetings');
        $method->setAccessible(true);

        return $method->invoke(app(DashboardMetricsService::class))->count();
    }

    /** A date safely before the cutover, and in the past. */
    private function beforeCutover(): string
    {
        return Carbon::parse($this->cutover)->subMonth()->toDateTimeString();
    }

    /**
     * A date on or after the cutover but still in the past.
     *
     * Travels the clock past the cutover when it has not been reached yet —
     * otherwise there is no window in which the new rule can apply, and the
     * half of the behaviour that matters most would go untested until the date
     * happens to arrive.
     */
    private function afterCutover(): string
    {
        $date = Carbon::parse($this->cutover)->addDay();

        if ($date->isFuture()) {
            Carbon::setTestNow($date->copy()->addDay());
        }

        return $date->toDateTimeString();
    }

    private function meeting(?string $at, string $status): void
    {
        DB::table('lead_follow_up')->insert([
            'id' => $this->nextId++,
            'company_id' => 1,
            'next_follow_up_date' => $at,
            'status' => $status,
        ]);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('lead_follow_up');
    }

    private function createMinimalSchema(): void
    {
        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('deal_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->dateTime('next_follow_up_date')->nullable();
            $table->string('status')->nullable();
            $table->timestamps();
        });
    }
}
