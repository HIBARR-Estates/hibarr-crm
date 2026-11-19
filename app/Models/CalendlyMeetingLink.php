<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * A Calendly scheduling link an admin offers in the schedule-meeting modal.
 *
 * @property int $id
 * @property int $company_id
 * @property string $name
 * @property string|null $description
 * @property string $url
 * @property array<int, int>|null $role_ids
 * @property bool $is_active
 * @property int $sort_order
 */
class CalendlyMeetingLink extends Model
{
    use HasCompany;

    protected $fillable = [
        'name',
        'description',
        'url',
        'role_ids',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'role_ids' => 'array',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    /**
     * Links a user holding $roleIds may see: active ones that either name no
     * roles (everyone) or name at least one of the user's roles.
     *
     * @param  array<int, int>  $roleIds
     */
    public function scopeVisibleToRoles(Builder $query, array $roleIds): Builder
    {
        $query->where('is_active', true);

        return $query->where(function (Builder $q) use ($roleIds) {
            // Not `= '[]'`: MySQL never matches a JSON array against a plain
            // string, so an emptied list would have quietly meant "nobody".
            $q->whereNull('role_ids')->orWhereJsonLength('role_ids', 0);

            foreach ($roleIds as $roleId) {
                $q->orWhereJsonContains('role_ids', (int) $roleId);
            }
        });
    }
}
