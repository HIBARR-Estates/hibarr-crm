<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Invoices and receipts for deal payment requests (KKTC Fatura and Tahsilat
 * Makbuzu).
 *
 * payment_document_settings holds one row per company: the seller details,
 * tax office approval, number ranges, KDV rate and bank details printed on
 * every document.
 *
 * payment_documents records each issued document. A number is taken from the
 * configured range the first time a document is issued and is never reused,
 * and the snapshot keeps exactly what was printed, so a later settings change
 * never rewrites an invoice that already went out.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('payment_document_settings')) {
            Schema::create('payment_document_settings', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id')->unique();

                // Seller, printed on every document.
                $table->string('legal_name')->nullable();
                $table->text('address')->nullable();
                $table->string('phone', 64)->nullable();
                $table->string('email')->nullable();
                $table->string('tax_office', 120)->nullable();
                $table->string('tax_number', 64)->nullable();
                $table->string('registration_number', 64)->nullable();

                // Branding.
                $table->string('logo')->nullable();
                $table->string('brand_color', 7)->default('#1d4d5c');

                // Numbering. The next number is derived from the documents
                // already issued in a series, so it can never skip or repeat.
                $table->string('invoice_series', 10)->default('A');
                $table->unsignedInteger('invoice_number_start')->default(1);
                $table->unsignedInteger('invoice_number_end')->nullable();
                $table->string('receipt_series', 10)->default('T');
                $table->unsignedInteger('receipt_number_start')->default(1);
                $table->unsignedInteger('receipt_number_end')->nullable();
                $table->unsignedTinyInteger('number_padding')->default(6);

                // Tax and tax office approval.
                $table->decimal('vat_rate', 5, 2)->default(16);
                $table->string('approval_number', 64)->nullable();
                $table->boolean('show_stamp_duty')->default(true);
                $table->boolean('show_approval_seal')->default(true);

                // Payment details.
                $table->string('bank_name')->nullable();
                $table->string('bank_account_name')->nullable();
                $table->string('iban', 64)->nullable();
                $table->string('swift', 32)->nullable();
                $table->unsignedSmallInteger('payment_term_days')->default(14);
                $table->boolean('show_try_equivalent')->default(true);

                // Wording.
                $table->boolean('bilingual_labels')->default(true);
                $table->text('footer_note')->nullable();

                $table->unsignedInteger('updated_by')->nullable();
                $table->timestamps();

                $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('payment_documents')) {
            Schema::create('payment_documents', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                // No foreign key: an issued number stays on record even if the
                // payment row is later removed.
                $table->unsignedInteger('payment_id');
                // "invoice" or "receipt".
                $table->string('kind', 16);
                $table->string('series', 10);
                $table->unsignedInteger('sequence');
                $table->timestamp('issued_at');
                $table->json('snapshot');
                $table->unsignedInteger('issued_by')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'kind', 'series', 'sequence'], 'payment_documents_number_unique');
                $table->unique(['payment_id', 'kind'], 'payment_documents_payment_kind_unique');
                $table->index(['company_id', 'kind']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_documents');
        Schema::dropIfExists('payment_document_settings');
    }
};
