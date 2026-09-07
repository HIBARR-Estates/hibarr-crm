<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Historical wins locked the whole deal (is_locked) and never set
 * commission_locked. After the lock split, those rows would look unlocked
 * for value/agent once someone cleared is_locked. Stamp commission_locked
 * on deals that already have commission rows, or that match the old
 * ProcessDealWonJob contract (won + is_locked).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('deals') || ! Schema::hasColumn('deals', 'commission_locked')) {
            return;
        }

        $hasCommissions = Schema::hasTable('mlm_commissions');

        $query = DB::table('deals')->where('commission_locked', 0);

        $query->where(function ($inner) use ($hasCommissions) {
            $inner->where(function ($wonAndLocked) {
                $wonAndLocked
                    ->where('outcome_status', 'won')
                    ->where('is_locked', 1);
            });

            if ($hasCommissions) {
                $inner->orWhereIn('id', function ($commissions) {
                    $commissions->select('deal_id')->from('mlm_commissions');
                });
            }
        });

        $query->update([
            'commission_locked' => 1,
            'commission_locked_at' => now(),
        ]);
    }

    public function down(): void
    {
        // Data backfill — not reversed. Clearing the flag would unlock
        // value/agent on deals that still have commissions.
    }
};
