<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lead financial assessments: dated snapshots of a lead's financial picture,
 * their lines, and a one-row-per-lead read model of the current final one.
 *
 * "At most one open draft / one current final per lead" is enforced with
 * nullable helper columns under a unique index (NULLs never collide), which
 * works on MySQL and SQLite alike without partial or generated indexes. The
 * service keeps them in step with `status`.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('financial_assessments')) {
            Schema::create('financial_assessments', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->unsignedInteger('lead_id');
                $table->date('as_of_date');
                $table->enum('status', ['draft', 'final', 'superseded'])->default('draft');
                $table->enum('source', ['call', 'consultation', 'client_form', 'api', 'manual', 'import'])->default('manual');
                // Reporting currency of this assessment (always fiat).
                $table->char('currency', 3);
                $table->unsignedInteger('prepared_by_user_id')->nullable();
                $table->timestamp('finalised_at')->nullable();
                $table->unsignedInteger('verified_by_user_id')->nullable();
                $table->timestamp('verified_at')->nullable();
                $table->decimal('available_now_override', 20, 2)->nullable();
                $table->text('override_reason')->nullable();
                // Calculated at finalise and frozen, together with the rates used.
                $table->json('totals')->nullable();
                $table->unsignedBigInteger('supersedes_assessment_id')->nullable();
                $table->text('notes')->nullable();
                // Helper columns for the one-draft / one-current-final rules.
                $table->unsignedInteger('draft_lead_id')->nullable();
                $table->unsignedInteger('current_lead_id')->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->unique('draft_lead_id', 'fa_assessments_one_draft_unique');
                $table->unique('current_lead_id', 'fa_assessments_one_current_unique');
                $table->index(['lead_id', 'status'], 'fa_assessments_lead_status_index');
                $table->index(['company_id', 'as_of_date'], 'fa_assessments_company_asof_index');

                $table->foreign('company_id', 'fa_assessments_company_id_foreign')
                    ->references('id')->on('companies')
                    ->onUpdate('cascade')->onDelete('cascade');
                $table->foreign('lead_id', 'fa_assessments_lead_id_foreign')
                    ->references('id')->on('leads')
                    ->onUpdate('cascade')->onDelete('cascade');
                $table->foreign('prepared_by_user_id', 'fa_assessments_prepared_by_foreign')
                    ->references('id')->on('users')
                    ->onUpdate('cascade')->onDelete('set null');
                $table->foreign('verified_by_user_id', 'fa_assessments_verified_by_foreign')
                    ->references('id')->on('users')
                    ->onUpdate('cascade')->onDelete('set null');
                $table->foreign('supersedes_assessment_id', 'fa_assessments_supersedes_foreign')
                    ->references('id')->on('financial_assessments')
                    ->onUpdate('cascade')->onDelete('set null');
            });
        }

        if (! Schema::hasTable('financial_assessment_lines')) {
            Schema::create('financial_assessment_lines', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->unsignedBigInteger('assessment_id');
                $table->unsignedBigInteger('type_id');
                // Eight decimals so a crypto amount such as 0.40 BTC is stored exactly.
                $table->decimal('amount', 24, 8);
                // ISO fiat code or crypto ticker.
                $table->string('currency', 10);
                $table->enum('frequency', ['once', 'monthly', 'yearly'])->default('once');
                $table->date('available_from')->nullable();
                $table->enum('certainty', ['confirmed', 'likely', 'uncertain'])->default('likely');
                $table->string('contributor_label', 120)->nullable();
                $table->unsignedInteger('contributor_lead_id')->nullable();
                $table->unsignedInteger('proof_file_id')->nullable();
                $table->text('note')->nullable();
                // The line this one was copied from in the previous assessment.
                $table->unsignedBigInteger('previous_line_id')->nullable();
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->timestamps();
                $table->softDeletes();

                $table->index('assessment_id', 'fa_lines_assessment_id_index');
                $table->index('type_id', 'fa_lines_type_id_index');

                $table->foreign('company_id', 'fa_lines_company_id_foreign')
                    ->references('id')->on('companies')
                    ->onUpdate('cascade')->onDelete('cascade');
                $table->foreign('assessment_id', 'fa_lines_assessment_id_foreign')
                    ->references('id')->on('financial_assessments')
                    ->onUpdate('cascade')->onDelete('cascade');
                $table->foreign('type_id', 'fa_lines_type_id_foreign')
                    ->references('id')->on('financial_assessment_line_types')
                    ->onUpdate('cascade')->onDelete('restrict');
                $table->foreign('contributor_lead_id', 'fa_lines_contributor_lead_foreign')
                    ->references('id')->on('leads')
                    ->onUpdate('cascade')->onDelete('set null');
                $table->foreign('proof_file_id', 'fa_lines_proof_file_foreign')
                    ->references('id')->on('lead_contact_files')
                    ->onUpdate('cascade')->onDelete('set null');
                $table->foreign('previous_line_id', 'fa_lines_previous_line_foreign')
                    ->references('id')->on('financial_assessment_lines')
                    ->onUpdate('cascade')->onDelete('set null');
            });
        }

        if (! Schema::hasTable('lead_financial_summaries')) {
            Schema::create('lead_financial_summaries', function (Blueprint $table) {
                $table->unsignedInteger('lead_id')->primary();
                $table->unsignedInteger('company_id');
                $table->unsignedBigInteger('current_assessment_id');
                $table->char('currency', 3);
                $table->date('as_of_date');
                $table->timestamp('finalised_at')->nullable();
                $table->date('refresh_due_on')->nullable();
                $table->boolean('verified')->default(false);
                $table->timestamp('verified_at')->nullable();
                $table->decimal('available_now', 20, 2)->default(0);
                $table->boolean('available_now_overridden')->default(false);
                $table->decimal('available_projected', 20, 2)->default(0);
                $table->decimal('uncertain_total', 20, 2)->default(0);
                $table->decimal('income_monthly', 20, 2)->default(0);
                $table->decimal('commitments_monthly', 20, 2)->default(0);
                $table->decimal('disposable_monthly', 20, 2)->default(0);
                $table->decimal('assets_total', 20, 2)->default(0);
                $table->decimal('funding_total', 20, 2)->default(0);
                $table->json('by_kind')->nullable();
                $table->json('by_type')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'available_now'], 'fa_summaries_company_available_index');
                $table->index(['company_id', 'as_of_date'], 'fa_summaries_company_asof_index');
                $table->index(['company_id', 'refresh_due_on'], 'fa_summaries_company_due_index');

                $table->foreign('company_id', 'fa_summaries_company_id_foreign')
                    ->references('id')->on('companies')
                    ->onUpdate('cascade')->onDelete('cascade');
                $table->foreign('lead_id', 'fa_summaries_lead_id_foreign')
                    ->references('id')->on('leads')
                    ->onUpdate('cascade')->onDelete('cascade');
                $table->foreign('current_assessment_id', 'fa_summaries_assessment_id_foreign')
                    ->references('id')->on('financial_assessments')
                    ->onUpdate('cascade')->onDelete('cascade');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_financial_summaries');
        Schema::dropIfExists('financial_assessment_lines');
        Schema::dropIfExists('financial_assessments');
    }
};
