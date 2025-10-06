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
        Schema::create('meeting_summary', function (Blueprint $table) {
            $table->id();
            $table->json('summary_object')->nullable();
            $table->unsignedBigInteger('meeting_type_id')->nullable();
            $table->unsignedBigInteger('deal_id')->nullable();
            $table->timestamps();
            
            $table->foreign('meeting_type_id', 'fk_meeting_summary_meeting_type_id')
                  ->references('id')
                  ->on('meeting_types')
                  ->onDelete('set null');
                  
            $table->foreign('deal_id', 'fk_meeting_summary_deal_id')
                  ->references('id')
                  ->on('deals')
                  ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('meeting_summary');
    }
};
