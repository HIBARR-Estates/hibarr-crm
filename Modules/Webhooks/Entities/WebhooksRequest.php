<?php

namespace Modules\Webhooks\Entities;

use App\Models\BaseModel;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WebhooksRequest extends BaseModel
{
    use HasCompany;

    protected $guarded = ['id'];

    public function webhookSettings(): BelongsTo
    {
        return $this->belongsTo(WebhooksSetting::class, 'webhooks_setting_id');
    }

}
