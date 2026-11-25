<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Admin-configurable vocabulary for lead financial assessments: the kinds of
 * line (each with a counting role), the types inside a kind, and the crypto
 * assets a line may be denominated in.
 *
 * Rows are deactivated, never deleted, so historic lines stay readable; there
 * is therefore no soft delete on these tables.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('financial_assessment_kinds')) {
            Schema::create('financial_assessment_kinds', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('key', 64);
                $table->string('label', 120);
                $table->enum('role', ['income', 'asset', 'funding', 'commitment']);
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->boolean('is_active')->default(true);
                $table->boolean('is_system')->default(false);
                $table->timestamps();

                $table->unique(['company_id', 'key'], 'fa_kinds_company_key_unique');
                $table->foreign('company_id', 'fa_kinds_company_id_foreign')
                    ->references('id')->on('companies')
                    ->onUpdate('cascade')->onDelete('cascade');
            });
        }

        if (! Schema::hasTable('financial_assessment_line_types')) {
            Schema::create('financial_assessment_line_types', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->unsignedBigInteger('kind_id');
                $table->string('key', 64);
                $table->string('label', 120);
                $table->enum('default_frequency', ['once', 'monthly', 'yearly'])->nullable();
                $table->enum('default_certainty', ['confirmed', 'likely', 'uncertain'])->nullable();
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->boolean('is_active')->default(true);
                $table->boolean('is_system')->default(false);
                $table->timestamps();

                $table->unique(['company_id', 'key'], 'fa_types_company_key_unique');
                $table->index('kind_id', 'fa_types_kind_id_index');
                $table->foreign('company_id', 'fa_types_company_id_foreign')
                    ->references('id')->on('companies')
                    ->onUpdate('cascade')->onDelete('cascade');
                $table->foreign('kind_id', 'fa_types_kind_id_foreign')
                    ->references('id')->on('financial_assessment_kinds')
                    ->onUpdate('cascade')->onDelete('restrict');
            });
        }

        if (! Schema::hasTable('financial_crypto_assets')) {
            Schema::create('financial_crypto_assets', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('ticker', 10);
                // CoinGecko asset id (e.g. "bitcoin"). CoinMarketCap is queried by ticker.
                $table->string('provider_id', 120);
                $table->string('name', 120);
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->unique(['company_id', 'ticker'], 'fa_crypto_company_ticker_unique');
                $table->foreign('company_id', 'fa_crypto_company_id_foreign')
                    ->references('id')->on('companies')
                    ->onUpdate('cascade')->onDelete('cascade');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_crypto_assets');
        Schema::dropIfExists('financial_assessment_line_types');
        Schema::dropIfExists('financial_assessment_kinds');
    }
};
