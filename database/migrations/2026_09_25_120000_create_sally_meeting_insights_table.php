<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sally_meeting_insights', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('meeting_follow_up_id');
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedBigInteger('deal_id')->nullable();
            $table->text('summary')->nullable();
            $table->longText('transcript')->nullable();
            $table->json('transcript_segments')->nullable();
            $table->json('bullet_points')->nullable();
            $table->timestamps();

            $table->unique('meeting_follow_up_id', 'sally_meeting_insights_follow_up_unique');

            $table->foreign('company_id', 'fk_sally_insights_company')
                ->references('id')->on('companies')->cascadeOnDelete();
            $table->foreign('meeting_follow_up_id', 'fk_sally_insights_follow_up')
                ->references('id')->on('lead_follow_up')->cascadeOnDelete();
            $table->foreign('lead_id', 'fk_sally_insights_lead')
                ->references('id')->on('leads')->nullOnDelete();
            $table->foreign('deal_id', 'fk_sally_insights_deal')
                ->references('id')->on('deals')->nullOnDelete();

            $table->index(['deal_id', 'company_id']);
            $table->index(['lead_id', 'company_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sally_meeting_insights');
    }
};
