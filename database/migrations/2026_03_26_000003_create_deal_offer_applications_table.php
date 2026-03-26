<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deal_offer_applications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('deal_id');
            $table->unsignedBigInteger('offer_id');
            $table->unsignedInteger('product_id');
            $table->string('resolved_from_type');
            $table->unsignedBigInteger('resolved_from_id');
            $table->unsignedDecimal('original_amount', 15, 2);
            $table->unsignedDecimal('discount_amount', 15, 2);
            $table->string('offer_type', 20); // snapshot of offer type
            $table->unsignedDecimal('offer_value', 15, 2); // snapshot of offer value
            $table->timestamps();

            $table->foreign('deal_id')->references('id')->on('deals')->cascadeOnDelete();
            $table->foreign('offer_id')->references('id')->on('offers')->cascadeOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();

            $table->index(['deal_id']);
            $table->index(['resolved_from_type', 'resolved_from_id'], 'doa_resolved_from_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deal_offer_applications');
    }
};
