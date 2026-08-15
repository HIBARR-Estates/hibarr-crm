<?php

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

        if (
            Schema::hasColumn('leads', 'preferred_contact_time')
            && Schema::hasColumn('leads', 'preferred_contact_times')
        ) {
            DB::table('leads')
                ->whereNotNull('preferred_contact_time')
                ->whereNull('preferred_contact_times')
                ->orderBy('id')
                ->chunkById(200, function ($leads) {
                    foreach ($leads as $lead) {
                        DB::table('leads')
                            ->where('id', $lead->id)
                            ->update([
                                'preferred_contact_times' => json_encode([(string) $lead->preferred_contact_time]),
                            ]);
                    }
                });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('leads')) {
            return;
        }

        if (Schema::hasColumn('leads', 'preferred_contact_times')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->dropColumn('preferred_contact_times');
            });
        }
    }
};
