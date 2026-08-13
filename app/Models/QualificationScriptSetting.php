<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Per-company settings for one OL qualification script (template).
 * The script itself lives in OL; only the lead-field mapping is ours.
 */
class QualificationScriptSetting extends BaseModel
{
    use HasCompany;

    protected $fillable = [
        'company_id',
        'template_id',
        'template_name',
        'auto_write',
    ];

    protected $casts = [
        'auto_write' => 'boolean',
    ];

    public function mappings(): HasMany
    {
        return $this->hasMany(QualificationFieldMapping::class, 'script_setting_id');
    }
}
