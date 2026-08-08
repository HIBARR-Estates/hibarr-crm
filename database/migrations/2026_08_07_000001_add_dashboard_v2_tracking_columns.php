<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Columns the v2 dashboards read from. Each one is denormalised on purpose:
 * the dashboards filter and sort across the whole book on every load, and
 * crm_events is under a 365-day retention policy so it cannot be the
 * long-term source of truth for a metric.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            if (! Schema::hasColumn('leads', 'primary_language')) {
                // leads.languages is "languages this person speaks" (multi-value);
                // this is the single one used for market segmentation.
                $table->string('primary_language', 10)->nullable()->after('languages');
                $table->index('primary_language', 'leads_primary_language_index');
            }

            if (! Schema::hasColumn('leads', 'assigned_at')) {
                $table->timestamp('assigned_at')->nullable()->after('lead_owner');
            }

            if (! Schema::hasColumn('leads', 'first_contacted_at')) {
                $table->timestamp('first_contacted_at')->nullable()->after('assigned_at');
                // Supports "not contacted within X hours": WHERE first_contacted_at
                // IS NULL AND created_at < ?
                $table->index(['first_contacted_at', 'created_at'], 'leads_first_contact_sla_index');
            }

            if (! Schema::hasColumn('leads', 'referred_by_agent_id')) {
                $table->unsignedBigInteger('referred_by_agent_id')->nullable()->after('source_id');
                $table->index('referred_by_agent_id', 'leads_referred_by_agent_id_index');
            }
        });

        if (
            Schema::hasColumn('leads', 'referred_by_agent_id')
            && ! $this->foreignKeyExists('leads', 'leads_referred_by_agent_id_foreign')
        ) {
            Schema::table('leads', function (Blueprint $table) {
                $table->foreign('referred_by_agent_id', 'leads_referred_by_agent_id_foreign')
                    ->references('id')
                    ->on('lead_agents')
                    ->onUpdate('cascade')
                    ->onDelete('set null');
            });
        }

        Schema::table('deals', function (Blueprint $table) {
            if (! Schema::hasColumn('deals', 'stage_entered_at')) {
                $table->timestamp('stage_entered_at')->nullable()->after('pipeline_stage_id');
                $table->index(['pipeline_stage_id', 'stage_entered_at'], 'deals_stage_dwell_index');
            }

            if (! Schema::hasColumn('deals', 'exchange_rate')) {
                // Snapshot, mirroring invoices/payments/expenses. Without it,
                // editing currencies.exchange_rate silently rewrites history.
                $table->double('exchange_rate')->nullable()->after('currency_id');
            }
        });

        Schema::table('pipeline_stages', function (Blueprint $table) {
            if (! Schema::hasColumn('pipeline_stages', 'target_duration_days')) {
                // Configured, not inferred. NULL = no expectation, never flagged stalled.
                $table->unsignedSmallInteger('target_duration_days')->nullable()->after('priority');
            }
        });

        Schema::table('lead_setting', function (Blueprint $table) {
            if (! Schema::hasColumn('lead_setting', 'first_contact_sla_hours')) {
                $table->unsignedSmallInteger('first_contact_sla_hours')->default(24);
            }
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            if ($this->foreignKeyExists('leads', 'leads_referred_by_agent_id_foreign')) {
                $table->dropForeign('leads_referred_by_agent_id_foreign');
            }
        });

        Schema::table('leads', function (Blueprint $table) {
            foreach (['primary_language', 'assigned_at', 'first_contacted_at', 'referred_by_agent_id'] as $column) {
                if (Schema::hasColumn('leads', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('deals', function (Blueprint $table) {
            foreach (['stage_entered_at', 'exchange_rate'] as $column) {
                if (Schema::hasColumn('deals', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('pipeline_stages', function (Blueprint $table) {
            if (Schema::hasColumn('pipeline_stages', 'target_duration_days')) {
                $table->dropColumn('target_duration_days');
            }
        });

        Schema::table('lead_setting', function (Blueprint $table) {
            if (Schema::hasColumn('lead_setting', 'first_contact_sla_hours')) {
                $table->dropColumn('first_contact_sla_hours');
            }
        });
    }

    private function foreignKeyExists(string $table, string $foreignKey): bool
    {
        $connection = Schema::getConnection();

        $result = $connection->selectOne(
            'SELECT COUNT(*) AS count FROM information_schema.TABLE_CONSTRAINTS
             WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = ?',
            [$connection->getDatabaseName(), $table, $foreignKey, 'FOREIGN KEY']
        );

        return (int) ($result->count ?? 0) > 0;
    }
};
