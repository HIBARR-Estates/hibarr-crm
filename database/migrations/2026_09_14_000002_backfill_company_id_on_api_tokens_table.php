<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * ApiTokenAuth now refuses tokens without a company instead of taking the
 * company from the X-COMPANY-ID header (or defaulting v2 calls to company 1).
 * On a single-company install those tokens were acting for that company
 * anyway, so bind them to it. With several companies the owner can't be
 * inferred: the tokens are left untouched (and will be refused) and logged.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('api_tokens') || ! Schema::hasColumn('api_tokens', 'company_id')) {
            return;
        }

        $tokenIds = DB::table('api_tokens')->whereNull('company_id')->pluck('id');

        if ($tokenIds->isEmpty()) {
            return;
        }

        $companyIds = DB::table('companies')->limit(2)->pluck('id');

        if ($companyIds->count() !== 1) {
            Log::warning('api_tokens company backfill skipped: owner company is ambiguous, set company_id on these tokens manually', [
                'token_ids' => $tokenIds->all(),
            ]);

            return;
        }

        DB::table('api_tokens')->whereIn('id', $tokenIds)->update(['company_id' => $companyIds->first()]);
    }

    public function down(): void
    {
        // Data backfill — not reversed; which tokens had no company isn't recorded.
    }
};
