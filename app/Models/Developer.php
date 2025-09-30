<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Developer extends Model
{
    use HasFactory;
    // Fillable fields
    protected $fillable = [
        'company_id',
        'name',
        'logo',
        'description',
    ];
    // Relationships
    public function projects(): HasMany 
    {
        return $this->hasMany(DeveloperProject::class);
    }
}
