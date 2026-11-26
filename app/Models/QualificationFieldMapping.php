<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One script question -> one lead field, plus the option-level value map.
 */
class QualificationFieldMapping extends BaseModel
{
    /** Write only when the lead field is still empty. */
    public const MODE_FILL_EMPTY = 'fill_empty';

    /** Always replace whatever is on the lead. */
    public const MODE_OVERWRITE = 'overwrite';

    public const WRITE_MODES = [self::MODE_FILL_EMPTY, self::MODE_OVERWRITE];

    protected $fillable = [
        'script_setting_id',
        'segment_key',
        'lead_field',
        'write_mode',
        'option_map',
        'target_options',
    ];

    protected $casts = [
        'option_map' => 'array',
        'target_options' => 'array',
    ];

    public function scriptSetting(): BelongsTo
    {
        return $this->belongsTo(QualificationScriptSetting::class, 'script_setting_id');
    }
}
