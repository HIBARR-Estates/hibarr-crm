<?php

namespace Modules\Sms\Entities;

use App\Models\BaseModel;
use Modules\Sms\Enums\SmsNotificationSlug;

class SmsTemplateId extends BaseModel
{
    protected $guarded = ['id'];

    protected $casts = [
        'sms_setting_slug' => SmsNotificationSlug::class,
    ];
}
