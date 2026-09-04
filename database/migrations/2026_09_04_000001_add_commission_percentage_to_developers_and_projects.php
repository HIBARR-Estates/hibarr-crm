<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Commission ceiling per developer, overridable per project.
 *
 * Sits between the company-wide max commission and the individual property: a
 * developer negotiates one rate across their portfolio, and a particular
 * project can be agreed at a different one. Whichever applies becomes the
 * deal's maximum commission — the total the agent, their uplines and the
 * company share out.
 *
 * Nullable throughout, and null means "not configured, defer outward" rather
 * than "zero commission" — a developer with no rate falls through to the
 * cycle snapshot and then the global setting, exactly as before this existed.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['developers', 'developer_projects'] as $table) {
            if (! Schema::hasTable($table) || Schema::hasColumn($table, 'commission_percentage')) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->decimal('commission_percentage', 5, 2)->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (['developers', 'developer_projects'] as $table) {
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'commission_percentage')) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->dropColumn('commission_percentage');
            });
        }
    }
};
