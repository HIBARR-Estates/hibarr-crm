<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One person's override on a company's agent workspace access list.
 * "allow" opens /agent for someone who is not a lead agent; "block" closes it
 * for a lead agent. See App\Support\AgentWorkspaceAccess.
 *
 * @property int $id
 * @property int $company_id
 * @property int $user_id
 * @property string $access
 * @property int|null $added_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read User|null $user
 * @property-read User|null $addedBy
 */
class AgentWorkspaceAccessEntry extends Model
{
    public const ALLOW = 'allow';

    public const BLOCK = 'block';

    public const ACCESS_VALUES = [self::ALLOW, self::BLOCK];

    protected $table = 'agent_workspace_access';

    protected $fillable = ['company_id', 'user_id', 'access', 'added_by'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id')->withoutGlobalScopes();
    }

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by')->withoutGlobalScopes();
    }
}
