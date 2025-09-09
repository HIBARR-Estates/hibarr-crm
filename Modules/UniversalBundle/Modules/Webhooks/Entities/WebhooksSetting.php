<?php

namespace Modules\Webhooks\Entities;

use App\Models\BaseModel;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WebhooksSetting extends BaseModel
{
    use HasCompany;

    const WEBHOOK_FOR = [
        'Client',
        'Employee',
        'Invoice',
        'Lead',
        'Project',
        'Proposal',
        'Task',
    ];
    const METHODS = [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE'
    ];

    const HEADERS = [
        'Accept',
        'Accept-Charset',
        'Accept-Encoding',
        'Accept-Language',
        'Accept-Datetime',
        'Authorization',
        'Cache-Control',
        'Connection',
        'Cookie',
        'Content-Length',
        'Content-Type',
        'Date',
        'Expect',
        'Forwarded',
        'From',
        'Host',
        'If-Match',
        'If-Modified-Since',
        'If-None-Match',
        'If-Range',
        'If-Unmodified-Since',
        'Max-Forwards',
        'Origin',
        'Pragma',
        'Proxy-Authorization',
        'Range',
        'Referer',
        'TE',
        'User-Agent',
        'Upgrade',
        'Via',
        'Warning',
        'custom'
    ];

    protected $guarded = ['id'];

    public function webhookLogs(): HasMany
    {
        return $this->hasMany(WebhooksLog::class, 'webhooks_setting_id');
    }

    public function webhooksRequests(): HasMany
    {
        return $this->hasMany(WebhooksRequest::class, 'webhooks_setting_id');
    }

    public function webhooksHeadersRequests(): HasMany
    {
        return $this->hasMany(WebhooksRequest::class, 'webhooks_setting_id')->where('request_type', 'headers');
    }

    public function webhooksBodyRequests(): HasMany
    {
        return $this->hasMany(WebhooksRequest::class, 'webhooks_setting_id')->where('request_type', 'body');
    }

}

