<?php

namespace Modules\RestAPI\Entities;

use App\Observers\UserObserver;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Client extends \App\Models\User
{
    protected $table = 'users';

    protected $default = [
        'id',
        'name',
        'email',
        'status',
        'company_id',
    ];

    protected $guarded = [
        'id',
        'created_at',
        'updated_at',
    ];

    protected $filterable = [
        'id',
        'users.name',
        'email',
        'status',
        'client_details.category_id',
        'client_details.sub_category_id',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(UserObserver::class);
    }

    public function clientDetail(): HasOne
    {
        return $this->hasOne(ClientDetails::class, 'user_id');
    }

    public function scopeVisibility($query)
    {

        if (api_user()) {
            // If employee or client show projects assigned
            $query->join('role_user', 'role_user.user_id', '=', 'users.id')
                ->join('roles', 'roles.id', '=', 'role_user.role_id')
                ->leftJoin('client_details', 'users.id', '=', 'client_details.user_id')
                ->select(
                    'users.id',
                    'users.name as name',
                    'users.email',
                    'users.created_at',
                    'client_details.company_name',
                    'users.image'
                )
                ->where('roles.name', 'client');

            return $query;
        }

        return $query;
    }

    public function setPasswordAttribute($value)
    {
        if ($value) {
            $this->attributes['password'] = bcrypt($value);
        }
    }
}
