<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * One recorded write (or sign-in event) in the application. Rows are written
 * by App\Support\AuditLog\AuditRecorder through the query builder, never
 * through this model, so recording fires no model events of its own.
 *
 * @property int $id
 * @property int|null $company_id
 * @property int|null $user_id
 * @property string|null $user_name
 * @property string $event
 * @property string $auditable_type
 * @property string|null $auditable_id
 * @property string|null $auditable_label
 * @property array|null $old_values
 * @property array|null $new_values
 * @property string|null $source
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property string|null $http_method
 * @property string|null $origin
 * @property \Illuminate\Support\Carbon|null $created_at
 */
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'audit_logs';

    protected $guarded = ['id'];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * Rows visible to a company: its own, plus system rows recorded with no
     * company (e.g. a failed sign-in for an unknown email).
     */
    public function scopeVisibleToCompany(Builder $query, ?int $companyId): Builder
    {
        return $query->where(function (Builder $q) use ($companyId) {
            $q->whereNull('company_id');

            if ($companyId) {
                $q->orWhere('company_id', $companyId);
            }
        });
    }
}
