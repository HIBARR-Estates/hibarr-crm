<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One person on a company's Company-dashboard access list.
 *
 * @property int $id
 * @property int $company_id
 * @property int $user_id
 * @property int|null $added_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class CompanyDashboardViewer extends Model
{
    protected $fillable = ['company_id', 'user_id', 'added_by'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id')->withoutGlobalScopes();
    }
}
