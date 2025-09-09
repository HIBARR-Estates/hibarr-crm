<?php

namespace Modules\RestAPI\Entities;

use App\Models\BaseModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\RestAPI\Observers\ApplicationSettingObserver;

class ApplicationSetting extends BaseModel
{
    // region Properties

    protected $table = 'rest_api_application_settings';

    protected $default = [
        'id',
        'name',
        'app_key',
    ];

    protected $hidden = [
        'created_at',
        'updated_at',
        'app_secret',
        'authorized_employee_id',
    ];

    //region Boot

    public static function boot()
    {
        parent::boot();

        static::observe(ApplicationSettingObserver::class);
    }

    //endregion

    public function setAppSecretAttribute($value)
    {
        if (isset($value)) {
            $this->attributes['app_secret'] = \Hash::make($value);
        }
    }

    public function authorizedEmployee(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'authorized_employee_id');
    }
}
