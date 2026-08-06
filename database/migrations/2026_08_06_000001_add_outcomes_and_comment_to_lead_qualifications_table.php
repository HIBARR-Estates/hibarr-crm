<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('lead_qualifications')) {
            return;
        }

        Schema::table('lead_qualifications', function (Blueprint $table) {
            if (! Schema::hasColumn('lead_qualifications', 'outcomes')) {
                $table->json('outcomes')->nullable()->after('outcome');
            }
            if (! Schema::hasColumn('lead_qualifications', 'outcome_comment')) {
                $table->text('outcome_comment')->nullable()->after('outcomes');
            }
        });

        if (Schema::hasColumn('lead_qualifications', 'outcomes')) {
            DB::table('lead_qualifications')
                ->whereNotNull('outcome')
                ->whereNull('outcomes')
                ->orderBy('id')
                ->chunkById(100, function ($rows) {
                    foreach ($rows as $row) {
                        DB::table('lead_qualifications')
                            ->where('id', $row->id)
                            ->update([
                                'outcomes' => json_encode([$row->outcome]),
                            ]);
                    }
                });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('lead_qualifications')) {
            return;
        }

        Schema::table('lead_qualifications', function (Blueprint $table) {
            if (Schema::hasColumn('lead_qualifications', 'outcome_comment')) {
                $table->dropColumn('outcome_comment');
            }
            if (Schema::hasColumn('lead_qualifications', 'outcomes')) {
                $table->dropColumn('outcomes');
            }
        });
    }
};
