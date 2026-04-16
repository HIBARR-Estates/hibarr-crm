<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            if (!$this->hasIndex('deals', 'deals_reporting_created_idx')) {
                $table->index(['company_id', 'agent_id', 'created_at'], 'deals_reporting_created_idx');
            }
            if (!$this->hasIndex('deals', 'deals_reporting_won_idx')) {
                $table->index(['company_id', 'agent_id', 'won_at'], 'deals_reporting_won_idx');
            }
        });

        Schema::table('leads', function (Blueprint $table) {
            $table->index(['company_id', 'created_at'], 'leads_reporting_created_idx');
        });

        Schema::table('lead_follow_up', function (Blueprint $table) {
            $table->index(['deal_id', 'next_follow_up_date'], 'follow_up_reporting_date_idx');
        });

        Schema::table('deal_notes', function (Blueprint $table) {
            $table->index(['deal_id', 'created_at'], 'deal_notes_reporting_idx');
        });

        Schema::table('lead_notes', function (Blueprint $table) {
            $table->index(['lead_id', 'created_at'], 'lead_notes_reporting_idx');
        });
    }

    public function down(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            $table->dropIndex('deals_reporting_created_idx');
            $table->dropIndex('deals_reporting_won_idx');
        });

        Schema::table('leads', function (Blueprint $table) {
            $table->dropIndex('leads_reporting_created_idx');
        });

        Schema::table('lead_follow_up', function (Blueprint $table) {
            $table->dropIndex('follow_up_reporting_date_idx');
        });

        Schema::table('deal_notes', function (Blueprint $table) {
            $table->dropIndex('deal_notes_reporting_idx');
        });

        Schema::table('lead_notes', function (Blueprint $table) {
            $table->dropIndex('lead_notes_reporting_idx');
        });
    }

    private function hasIndex(string $table, string $indexName): bool
    {
        $indexes = Schema::getConnection()
            ->select("SHOW INDEX FROM `{$table}` WHERE Key_name = ?", [$indexName]);

        return count($indexes) > 0;
    }
};
