<?php

namespace Modules\RestAPI\Entities;

use App\Observers\LeadObserver;

class Lead extends \App\Models\Lead
{
    protected $default = [
        'id',
        'company_name',
        'client_name',
        'client_email',
    ];

    protected $dates = [
        'start_date',
        'deadline',
    ];

    protected $hidden = [
        'created_at',
        'updated_at',
        'source_id',
        'client_id',
        'status_id',
        'agent_id',
        'category_id',
    ];

    protected $guarded = [
        'id',
        'created_at',
        'updated_at',
        'source_id',
        'client_id',
        'status_id',
        'agent_id',
        'category_id',
    ];

    protected $filterable = [
        'id',
        'company_name',
        'client_name',
        'client_email',
        'status_id',
        'agent_id',
        'source_id',
        'category_id',
        'next_follow_up',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(LeadObserver::class);
    }

    public function scopeVisibility($query)
    {

        $user = api_user();

        if ($user) {

            if ($user->hasRole('admin')) {
                return $query;
            }

            if ($user->hasRole('employee')) {
                $query->join('lead_agents', 'lead_agents.id', '=', 'leads.agent_id')
                    ->join('users', 'lead_agents.user_id', '=', 'users.id')
                    ->where('lead_agents.user_id', $user->id);
            }

            // If employee or client show projects assigned
            return $query;
        }

        return $query;
    }
}
