<?php

use App\Services\FinancialAssessment\FinancialAssessmentDefaults;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Gives every existing company the default kinds, types and crypto assets.
 * New companies are seeded by CompanyObserver. Safe to re-run: existing rows
 * are never touched.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('financial_assessment_kinds') || ! Schema::hasTable('companies')) {
            return;
        }

        foreach (DB::table('companies')->pluck('id') as $companyId) {
            FinancialAssessmentDefaults::seedForCompany((int) $companyId);
        }
    }

    public function down(): void
    {
        // Seeded rows are indistinguishable from admin-edited ones, so nothing is removed here.
    }
};
