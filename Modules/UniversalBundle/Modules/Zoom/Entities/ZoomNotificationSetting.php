<?php

namespace Modules\Zoom\Entities;

use App\Models\BaseModel;
use App\Traits\HasCompany;

class ZoomNotificationSetting extends BaseModel
{
    use HasCompany;

    protected $table = 'zoom_notification_settings';
}
