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
        Schema::create('commissions', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('employee_id'); // who earned the commission
            $table->string('event_type'); // type of event responsible for commission
            $table->unsignedInteger('source_event_id'); // ID of the event record
            $table->unsignedDecimal('amount', 12, 2); // commission amount
            $table->unsignedTinyInteger('level')->default(1); // MLM level 
            $table->string('rule_version')->nullable(); // rule version at time of calculation
            $table->string('status')->default('pending'); // status of the commission
            $table->timestamps();

            $table->foreign('employee_id')
                  ->references('id')->on('employee_details')
                  ->onDelete('cascade');

            $table->index(['event_type', 'source_event_id']); 
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('commissions');
    }
};
