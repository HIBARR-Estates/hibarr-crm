<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Entity reminder fields:
 * - remind_at: dynamic event datetime (not tied to close_date/due_date/etc.)
 * - reminders: optional custom cadence offsets ({time,type}[]); empty → prefs/org defaults
 *
 * Squashed from:
 * - 2026_08_04_154000_add_remind_at_to_deal_and_lead_notes_tables
 * - 2026_08_04_162600_add_reminder_cadence_fields_for_entity_reminders
 * - 2026_08_04_163700_add_dynamic_remind_at_to_entity_tables
 */
return new class extends Migration
{
    /** @var list<string> */
    private array $entityTables = [
        'tasks',
        'deal_notes',
        'lead_notes',
        'deals',
        'leads',
        'properties',
        'developer_projects',
        'developer_project_unit_types',
        'lead_flight_itineraries',
    ];

    public function up(): void
    {
        foreach ($this->entityTables as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($table) {
                if (! Schema::hasColumn($table, 'remind_at')) {
                    $blueprint->dateTime('remind_at')->nullable();
                }
                if (! Schema::hasColumn($table, 'reminders')) {
                    $blueprint->json('reminders')->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        foreach ($this->entityTables as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($table) {
                if (Schema::hasColumn($table, 'reminders')) {
                    $blueprint->dropColumn('reminders');
                }
                if (Schema::hasColumn($table, 'remind_at')) {
                    $blueprint->dropColumn('remind_at');
                }
            });
        }
    }
};
