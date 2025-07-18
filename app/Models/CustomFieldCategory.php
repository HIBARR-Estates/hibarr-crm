<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CustomFieldCategory extends Model
{
    protected $fillable = ['name', 'custom_field_group_id'];

    /**
     * Defines the relationship to the parent custom field group.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function group()
    {
        return $this->belongsTo(CustomFieldGroup::class, 'custom_field_group_id');
    }

    /**
     * Defines a one-to-many relationship to the CustomField model.
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany
     */
    public function customFields()
    {
        return $this->hasMany(CustomField::class);
    }
    use HasFactory;
}