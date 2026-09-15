<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * A token without a company used to be able to act for any company through
 * X-COMPANY-ID. ApiTokenAuth now refuses such tokens, and the previous
 * migration binds them on single-company installs; this makes the column
 * required so none can be created again. If tokens without a company are
 * still present (several companies, owner unknown) the column is left
 * nullable and the ids are logged — assign them, then re-run.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('api_tokens') || ! Schema::hasColumn('api_tokens', 'company_id')) {
            return;
        }

        $tokenIds = DB::table('api_tokens')->whereNull('company_id')->pluck('id');

        if ($tokenIds->isNotEmpty()) {
            Log::warning('api_tokens.company_id left nullable: tokens without a company still exist', [
                'token_ids' => $tokenIds->all(),
            ]);

            return;
        }

        Schema::table('api_tokens', function (Blueprint $table) {
            $table->unsignedInteger('company_id')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('api_tokens') || ! Schema::hasColumn('api_tokens', 'company_id')) {
            return;
        }

        Schema::table('api_tokens', function (Blueprint $table) {
            $table->unsignedInteger('company_id')->nullable()->change();
        });
    }
};
