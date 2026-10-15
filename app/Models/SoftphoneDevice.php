<?php

namespace App\Models;

use App\Traits\HasCompany;

/**
 * A sipgate Neo channel/line the browser softphone can register as. Each
 * device is its own WebRTC identity (own WSS + credentials); the active one
 * is what the browser registers and what outbound calls go out on.
 */
class SoftphoneDevice extends BaseModel
{
    use HasCompany;

    protected $table = 'softphone_devices';

    protected $fillable = [
        'company_id',
        'label',
        'wss_url',
        'uri',
        'authorization_username',
        'authorization_password',
        'display_name',
        'is_default',
        'added_by',
        'last_updated_by',
    ];

    protected $hidden = [
        'authorization_password',
    ];

    protected $casts = [
        'authorization_password' => 'encrypted',
        'is_default' => 'boolean',
    ];
}
