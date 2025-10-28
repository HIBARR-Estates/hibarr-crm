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
        // Drop table if it exists from old/abandoned migrations
        Schema::dropIfExists('lead_marketing');
        
        Schema::create('lead_marketing', function (Blueprint $table) {
            $table->id();
            
            // Foreign key to leads table
            $table->unsignedInteger('lead_id')->nullable();
            $table->foreign('lead_id')->references('id')->on('leads')->onDelete('cascade')->onUpdate('cascade');
            
            // UTM & Campaign Tracking
            $table->string('utm_source')->nullable();
            $table->string('utm_medium')->nullable();
            $table->string('utm_campaign')->nullable();
            $table->string('utm_content')->nullable();
            $table->string('utm_term')->nullable();
            $table->string('utm_audience')->nullable();
            
            // Traffic Source
            $table->string('traffic_source_id')->nullable();
            
            // Social Media Tracking
            $table->string('facebook_click_id')->nullable();
            $table->string('facebook_lead_id')->nullable();
            
            // Engagement Tracking (Boolean flags)
            $table->boolean('has_registered_for_the_webinar')->default(false);
            $table->boolean('has_joined_the_facebook_group')->default(false);
            $table->boolean('has_downloaded_the_ebook')->default(false);
            $table->boolean('has_attended_the_webinar')->default(false);
            $table->boolean('registered_for_zoom_meeting')->default(false);
            
            // Webinar tracking
            $table->date('last_webinar_date')->nullable();
            
            // Lead Scoring
            $table->integer('contact_score')->nullable()->default(0);
            
            // Lead Categorization
            $table->string('type')->nullable();
            $table->string('vip_package')->nullable();
            $table->string('bank_package')->nullable();
            
            $table->timestamps();
            
            // Indexes for better query performance
            $table->index('lead_id');
            $table->index('utm_source');
            $table->index('utm_campaign');
            $table->index('contact_score');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lead_marketing');
    }
};
