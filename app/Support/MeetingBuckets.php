<?php

namespace App\Support;

use App\Models\DealFollowUp;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\DB;

/**
 * The one definition of which group a meeting belongs to: live, upcoming or
 * past.
 *
 * The Meetings list, the tab tallies and the "next up" cards each used to
 * restate these rules separately (as closures, as raw SQL and as an id
 * query), and the restatements disagreed — a cancelled meeting dated next
 * week was Upcoming in the list and Past in the browser, and a meeting that
 * had started but not ended was in neither tab. Everything now reads the
 * conditions below, so a row is in exactly one of Upcoming / Past.
 *
 * Upcoming means "not over yet": still scheduled and not yet ended, which
 * includes a meeting that is running right now (live). Past is its exact
 * complement: no longer scheduled, or already ended. `live` is a subset of
 * Upcoming that the "next up" strip calls out.
 *
 * A missing status reads as scheduled, the same default the browser applies
 * in `meetingBucket()`.
 */
final class MeetingBuckets
{
    private const STATUS = "COALESCE(status, 'scheduled')";

    public function __construct(
        private readonly CarbonInterface $now,
        private readonly int $defaultDuration = DealFollowUp::DEFAULT_DURATION_MINUTES,
    ) {}

    /**
     * Start + duration, in the connection's own dialect. MySQL is what runs
     * in production; SQLite is what the test suite runs on.
     */
    private function endSql(): string
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return "datetime(next_follow_up_date, '+' || COALESCE(duration, ?) || ' minutes')";
        }

        return 'DATE_ADD(next_follow_up_date, INTERVAL COALESCE(duration, ?) MINUTE)';
    }

    /**
     * Started, not yet ended, still scheduled.
     *
     * @return array{0: string, 1: array<int, mixed>}
     */
    public function live(): array
    {
        return [
            '('.self::STATUS." = 'scheduled'"
                .' AND next_follow_up_date <= ?'
                .' AND '.$this->endSql().' >= ?)',
            [$this->now, $this->defaultDuration, $this->now],
        ];
    }

    /**
     * Not over yet: still scheduled and not yet ended (live included).
     *
     * @return array{0: string, 1: array<int, mixed>}
     */
    public function upcoming(): array
    {
        return [
            '('.self::STATUS." = 'scheduled' AND ".$this->endSql().' >= ?)',
            [$this->defaultDuration, $this->now],
        ];
    }

    /**
     * No longer scheduled, or already ended. The exact complement of
     * `upcoming()`.
     *
     * @return array{0: string, 1: array<int, mixed>}
     */
    public function past(): array
    {
        return [
            '('.self::STATUS." != 'scheduled' OR ".$this->endSql().' < ?)',
            [$this->defaultDuration, $this->now],
        ];
    }

    public function scopeLive(EloquentBuilder|QueryBuilder $query): EloquentBuilder|QueryBuilder
    {
        return $query->whereRaw(...$this->live());
    }

    public function scopeUpcoming(EloquentBuilder|QueryBuilder $query): EloquentBuilder|QueryBuilder
    {
        return $query->whereRaw(...$this->upcoming());
    }

    public function scopePast(EloquentBuilder|QueryBuilder $query): EloquentBuilder|QueryBuilder
    {
        return $query->whereRaw(...$this->past());
    }
}
