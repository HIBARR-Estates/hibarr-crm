<?php

namespace App\Email\Enums;

use App\Models\Deal;
use App\Models\Lead;
use Illuminate\Database\Eloquent\Model;

/** The records a conversation can be linked to. Stored as the short value, not a class name. */
enum LinkableType: string
{
    case Lead = 'lead';
    case Deal = 'deal';

    /**
     * @return class-string<Model>
     */
    public function modelClass(): string
    {
        return match ($this) {
            self::Lead => Lead::class,
            self::Deal => Deal::class,
        };
    }

    public static function tryFromModel(Model $record): ?self
    {
        return match (true) {
            $record instanceof Lead => self::Lead,
            $record instanceof Deal => self::Deal,
            default => null,
        };
    }
}
