<?php

namespace Modules\Sms\Entities;

use App\Models\BaseModel;
use App\Traits\HasCompany;
use Modules\Sms\Enums\SmsNotificationSlug;

class SmsNotificationSetting extends BaseModel
{
    use HasCompany;

    protected $guarded = ['id'];
    protected $casts = [
        'slug' => SmsNotificationSlug::class,
    ];
}
