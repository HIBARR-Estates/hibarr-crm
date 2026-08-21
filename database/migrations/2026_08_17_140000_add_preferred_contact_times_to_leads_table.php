<?php

use App\Enums\PreferredContactTime;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('leads')) {
            return;
        }

        if (! Schema::hasColumn('leads', 'preferred_contact_times')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->json('preferred_contact_times')->nullable()->after('preferred_contact_time');
            });
        }

        DB::table('leads')
            ->whereNotNull('preferred_contact_time')
            ->orderBy('id')
            ->chunkById(200, function ($rows): void {
                foreach ($rows as $row) {
                    $raw = $row->preferred_contact_time;
                    $times = PreferredContactTime::normalizeList($raw);
                    $scalar = $times[0] ?? null;

                    DB::table('leads')->where('id', $row->id)->update([
                        'preferred_contact_time' => $scalar,
                        'preferred_contact_times' => $times === [] ? null : json_encode($times),
                    ]);
                }
            });

        DB::table('leads')
            ->whereNull('preferred_contact_times')
            ->whereNotNull('preferred_contact_time')
            ->orderBy('id')
            ->chunkById(200, function ($rows): void {
                foreach ($rows as $row) {
                    $scalar = PreferredContactTime::tryFrom((string) $row->preferred_contact_time)?->value;

                    if ($scalar === null) {
                        continue;
                    }

                    DB::table('leads')->where('id', $row->id)->update([
                        'preferred_contact_times' => json_encode([$scalar]),
                    ]);
                }
            });
    }

    public function down(): void
    {
        if (! Schema::hasTable('leads') || ! Schema::hasColumn('leads', 'preferred_contact_times')) {
            return;
        }

        Schema::table('leads', function (Blueprint $table) {
            $table->dropColumn('preferred_contact_times');
        });
    }
};
