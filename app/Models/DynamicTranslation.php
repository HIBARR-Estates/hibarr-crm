<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class DynamicTranslation extends BaseModel
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';
    public const STATUS_PARTIAL = 'partial';
    public const STATUS_COMPLETE = 'complete';

    protected $table = 'dynamic_translations';

    protected $fillable = [
        'hash_key',
        'source_text',
        'en',
        'de',
        'ru',
        'tr',
        'status',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function isComplete(): bool
    {
        return $this->status === self::STATUS_COMPLETE;
    }
}
