<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Migrate existing deal_watcher data to the new pivot table
        if (Schema::hasColumn('deals', 'deal_watcher')) {
            $dealsWithWatchers = DB::table('deals')
                ->whereNotNull('deal_watcher')
                ->where('deal_watcher', '!=', '')
                ->get();

            foreach ($dealsWithWatchers as $deal) {
                DB::table('deal_watchers')->insert([
                    'deal_id' => $deal->id,
                    'user_id' => $deal->deal_watcher,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            // Remove the old deal_watcher column
            Schema::table('deals', function (Blueprint $table) {
                $table->dropColumn('deal_watcher');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Add back the old deal_watcher column
        Schema::table('deals', function (Blueprint $table) {
            $table->integer('deal_watcher')->nullable();
        });

        // Migrate data back from pivot table to the old column
        $dealWatchers = DB::table('deal_watchers')->get();
        
        foreach ($dealWatchers as $watcher) {
            DB::table('deals')
                ->where('id', $watcher->deal_id)
                ->update(['deal_watcher' => $watcher->user_id]);
        }
    }
};
