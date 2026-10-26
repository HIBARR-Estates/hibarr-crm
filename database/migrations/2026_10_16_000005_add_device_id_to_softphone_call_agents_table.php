<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lets the call pool be managed per channel/line instead of one global pool.
 *
 * `user_id` was unique, which capped every agent at a single pool row. An agent
 * that works two lines needs a row per line, so the uniqueness moves to the
 * (device_id, user_id) pair. Existing rows are attached to the company's
 * default line so behaviour is unchanged after the upgrade.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('softphone_call_agents', 'device_id')) {
            Schema::table('softphone_call_agents', function (Blueprint $table) {
                $table->unsignedBigInteger('device_id')->nullable()->after('company_id')->index();
            });
        }

        // Drop the single-column unique on user_id. MySQL has no
        // `DROP INDEX IF EXISTS`, so the index is probed first.
        $unique = 'softphone_call_agents_user_id_unique';

        if ($this->hasIndex('softphone_call_agents', $unique)) {
            Schema::table('softphone_call_agents', function (Blueprint $table) use ($unique) {
                $table->dropUnique($unique);
            });
        }

        if (! $this->hasIndex('softphone_call_agents', 'softphone_call_agents_device_user_unique')) {
            Schema::table('softphone_call_agents', function (Blueprint $table) {
                $table->unique(['device_id', 'user_id'], 'softphone_call_agents_device_user_unique');
            });
        }

        // Attach existing pool members to the company's default line.
        $defaultDeviceIds = DB::table('softphone_devices')
            ->where('is_default', true)
            ->pluck('id', 'company_id');

        DB::table('softphone_call_agents')
            ->orderBy('id')
            ->each(function ($agent) use ($defaultDeviceIds): void {
                $deviceId = $defaultDeviceIds[$agent->company_id] ?? null;
                if ($deviceId !== null) {
                    DB::table('softphone_call_agents')
                        ->where('id', $agent->id)
                        ->update(['device_id' => $deviceId]);
                }
            });
    }

    /** True when the named index exists on the table (MySQL-safe). */
    private function hasIndex(string $table, string $index): bool
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql') {
            return DB::selectOne(
                'SELECT 1 FROM information_schema.statistics
                 WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
                [$table, $index],
            ) !== null;
        }

        return Schema::hasIndex($table, [$index]);
    }

    public function down(): void
    {
        Schema::table('softphone_call_agents', function (Blueprint $table) {
            $table->dropUnique('softphone_call_agents_device_user_unique');
            $table->dropColumn('device_id');
            $table->unique('user_id');
        });
    }
};
