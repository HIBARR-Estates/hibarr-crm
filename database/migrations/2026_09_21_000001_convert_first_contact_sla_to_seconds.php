<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The first-contact SLA moves from whole hours to seconds, so the settings
 * screen can offer minute/second precision for a fast-response team without
 * losing that precision back to an integer-hours column the moment it's
 * saved.
 *
 * Backfilled row by row rather than with a single `hours * 3600` UPDATE:
 * `lead_setting` holds one row per company, never more than a few hundred
 * across the whole install, so there is no performance case for raw SQL here
 * — and a portable loop means this migration behaves the same on sqlite (the
 * test database) as it does on MySQL, unlike the backfill migration next to
 * this one in git history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lead_setting', function (Blueprint $table) {
            if (! Schema::hasColumn('lead_setting', 'first_contact_sla_seconds')) {
                $table->unsignedInteger('first_contact_sla_seconds')->default(24 * 3600);
            }
        });

        if (Schema::hasColumn('lead_setting', 'first_contact_sla_hours')) {
            DB::table('lead_setting')->select('id', 'first_contact_sla_hours')->get()
                ->each(function ($row) {
                    DB::table('lead_setting')->where('id', $row->id)->update([
                        'first_contact_sla_seconds' => (int) $row->first_contact_sla_hours * 3600,
                    ]);
                });

            $this->dropColumns('lead_setting', ['first_contact_sla_hours']);
        }
    }

    public function down(): void
    {
        Schema::table('lead_setting', function (Blueprint $table) {
            if (! Schema::hasColumn('lead_setting', 'first_contact_sla_hours')) {
                $table->unsignedSmallInteger('first_contact_sla_hours')->default(24);
            }
        });

        if (Schema::hasColumn('lead_setting', 'first_contact_sla_seconds')) {
            DB::table('lead_setting')->select('id', 'first_contact_sla_seconds')->get()
                ->each(function ($row) {
                    DB::table('lead_setting')->where('id', $row->id)->update([
                        // At least 1: a sub-hour value would otherwise round
                        // down to a 0-hour SLA the old column can't represent.
                        'first_contact_sla_hours' => max(1, (int) round($row->first_contact_sla_seconds / 3600)),
                    ]);
                });

            $this->dropColumns('lead_setting', ['first_contact_sla_seconds']);
        }
    }

    /**
     * One column per Schema::table call — SQLite refuses multiple
     * dropColumn calls in a single modification, which would make this
     * migration irreversible on the test database. Same helper as its
     * neighbour migration in this directory.
     *
     * @param  array<int, string>  $columns
     */
    private function dropColumns(string $table, array $columns): void
    {
        foreach ($columns as $column) {
            if (! Schema::hasColumn($table, $column)) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($column) {
                $blueprint->dropColumn($column);
            });
        }
    }
};
