<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeveloperProject extends Model
{
    use HasFactory;

    // Fillable fields
    protected $fillable = [
        'company_id',
        'name',
        'description',
        'images',
        'developer_id',
    ];

    // Casts
    protected $casts = [
        'images' => 'array',
    ];

    // Relationships
    public function developer(): BelongsTo
    {
        return $this->belongsTo(Developer::class);
    }
}
