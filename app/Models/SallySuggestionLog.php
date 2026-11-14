<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A Sally suggestion an agent logged as a CRM note. One row per
 * (insight, suggestion) — the unique key is what makes double-logging
 * impossible; the suggestion's text may keep evolving on re-sync, but this
 * row is written once and never touched again.
 */
class SallySuggestionLog extends Model
{
    use HasCompany;

    public const MODE_AS_IS = 'as_is';
    public const MODE_AFTER_EDIT = 'after_edit';

    protected $fillable = [
        'company_id',
        'sally_meeting_insight_id',
        'suggestion_id',
        'lead_id',
        'deal_id',
        'note_id',
        'logged_mode',
        'logged_text',
        'logged_by',
        'logged_at',
    ];

    protected $casts = [
        'logged_at' => 'datetime',
    ];

    public function insight(): BelongsTo
    {
        return $this->belongsTo(SallyMeetingInsight::class, 'sally_meeting_insight_id');
    }
}
