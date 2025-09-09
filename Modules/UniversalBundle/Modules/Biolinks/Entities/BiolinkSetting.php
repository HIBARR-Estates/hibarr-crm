<?php

namespace Modules\Biolinks\Entities;

use App\Models\BaseModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Biolinks\Enums\BlockHoverAnimation;
use Modules\Biolinks\Enums\BlockSpacing;
use Modules\Biolinks\Enums\Font;
use Modules\Biolinks\Enums\Theme;
use Modules\Biolinks\Enums\YesNo;
use Modules\Biolinks\Enums\VerifiedBadge;

class BiolinkSetting extends BaseModel
{

    protected $appends = [
        'favicon_url'
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'block_space' => BlockSpacing::class,
        'block_hover_animation' => BlockHoverAnimation::class,
        'verified_badge' => VerifiedBadge::class,
        'display_branding' => YesNo::class,
        'is_sensitive' => YesNo::class,
        'theme' => Theme::class,
        'font' => Font::class,
    ];

    public function getFaviconUrlAttribute()
    {
        if (is_null($this->favicon)) {
            return global_setting()->favicon_url;
        }

        return asset_url_local_s3('favicon/' . $this->favicon);
    }

    public function biolink(): BelongsTo
    {
        return $this->belongsTo(Biolink::class, 'biolink_id');
    }

}
