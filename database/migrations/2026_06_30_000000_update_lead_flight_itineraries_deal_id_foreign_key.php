<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lead_flight_itineraries', function (Blueprint $table) {
            $table->dropForeign(['deal_id']);
            $table->foreign('deal_id')->references('id')->on('deals')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('lead_flight_itineraries', function (Blueprint $table) {
            $table->dropForeign(['deal_id']);
            $table->foreign('deal_id')->references('id')->on('deals')->onDelete('cascade');
        });
    }
};
