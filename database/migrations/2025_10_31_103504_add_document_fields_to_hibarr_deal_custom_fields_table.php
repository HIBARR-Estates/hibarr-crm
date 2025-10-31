<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('hibarr_deal_custom_fields')) {
            Schema::create('hibarr_deal_custom_fields', function (Blueprint $table) {
                $table->id();
                $table->foreignId('deal_id')->constrained('deals')->onDelete('cascade');
                $table->string('interested_in')->nullable();
                $table->string('motivation/comment')->nullable();
                $table->string('purchase_timeline')->nullable();
                $table->string('budget_range')->nullable();
                $table->boolean('strategy_meeting_booked')->default(false);
                $table->boolean('downpayment_paid')->default(false);
                $table->date('inspection_trip_date')->nullable();
                $table->string('deposit_confirmation')->nullable();
                $table->string('reservation_agreement')->nullable();
                $table->string('sales_contract')->nullable();
                $table->timestamps();
            });
        } else {
            Schema::table('hibarr_deal_custom_fields', function (Blueprint $table) {
                if (!Schema::hasColumn('hibarr_deal_custom_fields', 'deposit_confirmation')) {
                    $table->string('deposit_confirmation')->nullable();
                }
                if (!Schema::hasColumn('hibarr_deal_custom_fields', 'reservation_agreement')) {
                    $table->string('reservation_agreement')->nullable();
                }
                if (!Schema::hasColumn('hibarr_deal_custom_fields', 'sales_contract')) {
                    $table->string('sales_contract')->nullable();
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('hibarr_deal_custom_fields');
    }
};
