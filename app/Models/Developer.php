<?php


namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Developer extends BaseModel
{
    use HasCompany;

    protected $fillable = [
        'company_id',
        'name',
        'logo',
        'description',
        'added_by',
        'last_updated_by',
        'assigned_to', // For ownership-based permissions
    ];

    // Relationships
    public function projects(): HasMany 
    {
        return $this->hasMany(DeveloperProject::class);
    }

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    public function lastUpdatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'last_updated_by');
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }
}