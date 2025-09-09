<?php

namespace Modules\Biolinks\Entities;

use App\Models\BaseModel;
use Modules\Biolinks\Enums\Size;
use Modules\Biolinks\Enums\Status;
use Modules\Biolinks\Enums\Heading;
use Modules\Biolinks\Enums\Alignment;
use Modules\Biolinks\Enums\Animation;
use Modules\Biolinks\Enums\ObjectFit;
use Modules\Biolinks\Enums\AvatarSize;
use Modules\Biolinks\Enums\PaypalType;
use Illuminate\Database\Eloquent\Model;
use Modules\Biolinks\Enums\BorderStyle;
use Illuminate\Notifications\Notifiable;
use Modules\Biolinks\Enums\BorderRadius;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class BiolinkBlocks extends BaseModel
{

    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     */
    protected $guarded = ['id'];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'status' => Status::class,
        'object_fit' => ObjectFit::class,
        'text_alignment' => Alignment::class,
        'border_radius' => BorderRadius::class,
        'animation' => Animation::class,
        'border_style' => BorderStyle::class,
        'heading_type' => Heading::class,
        'avatar_size' => AvatarSize::class,
        'icon_size' => Size::class,
        'paypal_type' => PaypalType::class,
    ];

    const FILE_PATH = 'biolinks';

    public function getFileUrlAttribute()
    {
        if (str_contains($this->image, 'http')) {
            return $this->image;
        }

        return ($this->image) ? asset_url_local_s3('biolinks/' . $this->image) : '';
    }

}
