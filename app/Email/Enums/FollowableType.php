<?php

namespace App\Email\Enums;

use App\Models\DealFollowUp;
use App\Models\DealNote;
use App\Models\LeadNote;
use App\Models\Task;
use InvalidArgumentException;

enum FollowableType: string
{
    case Task = 'task';
    case DealNote = 'deal_note';
    case LeadNote = 'lead_note';
    case Meeting = 'meeting';

    public function modelClass(): string
    {
        return match ($this) {
            self::Task => Task::class,
            self::DealNote => DealNote::class,
            self::LeadNote => LeadNote::class,
            self::Meeting => DealFollowUp::class,
        };
    }

    public static function forModel(object $model): self
    {
        return match (true) {
            $model instanceof Task => self::Task,
            $model instanceof DealNote => self::DealNote,
            $model instanceof LeadNote => self::LeadNote,
            $model instanceof DealFollowUp => self::Meeting,
            default => throw new InvalidArgumentException('Unsupported follow-up type.'),
        };
    }
}
