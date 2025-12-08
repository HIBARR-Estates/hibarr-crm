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
        Schema::table('employee_details', function (Blueprint $table) {
            $table->unsignedInteger('referral_id')->nullable()->index();
            $table->integer('level')->default(1);

            $table->foreign('referral_id')->references('id')->on('employee_details')->onDelete('set null');
        });

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('employee_details', function (Blueprint $table) {
            $table->dropForeign(['referral_id']);
            $table->dropColumn(['referral_id', 'level']);
        });
    }
};
