<?php

namespace App\Models;


use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadMarketing extends BaseModel
{
    protected $table = 'lead_marketing';

    protected $fillable = [
        'lead_id',
        // UTM & Campaign Tracking
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'utm_audience',
        // Traffic Source
        'traffic_source_id',
        // Social Media Tracking
        'facebook_click_id',
        'facebook_lead_id',
        // Engagement Tracking
        'has_registered_for_the_webinar',
        'has_joined_the_facebook_group',
        'has_downloaded_the_ebook',
        'has_attended_the_webinar',
        'registered_for_zoom_meeting',
        'last_webinar_date',
        // Lead Scoring
        'contact_score',
        // Lead Categorization
        'type',
        'vip_package',
        'bank_package',
    ];

    protected $casts = [
        'has_registered_for_the_webinar' => 'boolean',
        'has_joined_the_facebook_group' => 'boolean',
        'has_downloaded_the_ebook' => 'boolean',
        'has_attended_the_webinar' => 'boolean',
        'registered_for_zoom_meeting' => 'boolean',
        'last_webinar_date' => 'date',
        'contact_score' => 'integer',
    ];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }

}