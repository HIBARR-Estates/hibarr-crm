<?php

namespace App\Enums;

enum LeadActivityType: string
{
    case NOTE_ADDED = 'note_added';
    case NOTE_UPDATED = 'note_updated';
    case NOTE_DELETED = 'note_deleted';
    case FILE_UPLOADED = 'file_uploaded';
    case FILE_UPDATED = 'file_updated';
    case FILE_DELETED = 'file_deleted';

    public function label(): string
    {
        return match ($this) {
            self::NOTE_ADDED => 'Note Added',
            self::NOTE_UPDATED => 'Note Updated',
            self::NOTE_DELETED => 'Note Deleted',
            self::FILE_UPLOADED => 'File Uploaded',
            self::FILE_UPDATED => 'File Updated',
            self::FILE_DELETED => 'File Deleted',
        };
    }

    public function icon(): string
    {
        return match ($this) {
            self::NOTE_ADDED, self::NOTE_UPDATED, self::NOTE_DELETED => 'note',
            self::FILE_UPLOADED, self::FILE_UPDATED, self::FILE_DELETED => 'file',
        };
    }
}
