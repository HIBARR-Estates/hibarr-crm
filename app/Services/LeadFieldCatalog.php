<?php

namespace App\Services;

use App\Models\Lead;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * The lead fields an external caller (the website's capture flow) may write through the contact
 * API, read live from the `leads` table so a column added by a future migration is offered with no
 * code change. The core fields (nationality, occupation, languages, age, ...) are `leads` columns
 * too, so they appear here without special handling.
 *
 * Deny by default: system and identity columns are never offered, and only types a plain value can
 * be written to are. A new internal column that should stay out of reach has to be blocked here.
 */
class LeadFieldCatalog
{
    public const MODE_FILL = 'fill';

    public const MODE_OVERWRITE = 'overwrite';

    public const MODE_APPEND = 'append';

    private const CACHE_KEY = 'lead-field-catalog:v1';

    private const CACHE_TTL_SECONDS = 300;

    /** Columns that are system- or identity-owned: never writable from outside. */
    private const BLOCKED = [
        'id', 'company_id', 'hash', 'client_email', 'created_at', 'updated_at', 'deleted_at',
        'assigned_at', 'first_contacted_at', 'column_priority', 'lead_owner', 'chat_id', 'telegram_chat_id',
        'next_follow_up', 'image',
    ];

    /** Foreign keys and audit pointers: the value of a form answer can never be one. */
    private const BLOCKED_SUFFIXES = ['_id', '_by'];

    /** Friendlier labels where the column name reads badly. Anything else is derived from the column name. */
    private const LABELS = [
        'client_name' => 'Name',
        'mobile' => 'Phone (mobile)',
        'cell' => 'Phone (cell)',
        'office' => 'Phone (office)',
        'note' => 'Note',
        'total_value' => 'Total value',
        'value' => 'Value',
        'date_of_birth' => 'Date of birth',
        'client_whatsapp' => 'WhatsApp',
        'client_instagram' => 'Instagram',
        'client_telegram' => 'Telegram',
        'type' => 'Contact type',
    ];

    /**
     * Every writable lead field, in column order.
     *
     * @return list<array{key: string, label: string, type: string, group: string, writable: bool, write_modes: list<string>, max_length: int|null, options: list<string>|null}>
     */
    public function all(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL_SECONDS, fn () => $this->introspect());
    }

    /**
     * @return array<string, array{key: string, label: string, type: string, group: string, writable: bool, write_modes: list<string>, max_length: int|null, options: list<string>|null}>
     */
    public function byKey(): array
    {
        $byKey = [];
        foreach ($this->all() as $field) {
            $byKey[$field['key']] = $field;
        }

        return $byKey;
    }

    public function find(string $key): ?array
    {
        return $this->byKey()[$key] ?? null;
    }

    public function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    private function introspect(): array
    {
        $model = new Lead;
        $casts = $model->getCasts();

        $fields = [];
        foreach ($this->readColumns($model) as $column => $definition) {
            if ($this->isBlocked($column)) {
                continue;
            }

            $type = $this->resolveType($casts[$column] ?? null, $definition);
            if ($type === null) {
                continue;
            }

            $modes = [self::MODE_FILL, self::MODE_OVERWRITE];
            if ($type['type'] === 'text') {
                $modes[] = self::MODE_APPEND;
            }

            $fields[] = [
                'key' => $column,
                'label' => self::LABELS[$column] ?? Str::title(str_replace('_', ' ', $column)),
                'type' => $type['type'],
                'group' => 'lead',
                'writable' => true,
                'write_modes' => $modes,
                'max_length' => $type['type'] === 'string' ? $definition['length'] : null,
                'options' => $type['options'],
            ];
        }

        return $fields;
    }

    /**
     * The table's columns and their database types, read straight from the database. Doctrine (what
     * `Schema::getColumnType` uses) throws on MySQL `enum` columns, which `leads` has, so it is avoided.
     *
     * @return array<string, array{type: string, length: int|null, enum: list<string>|null}>
     */
    private function readColumns(Lead $model): array
    {
        $connection = $model->getConnection();
        $table = $model->getTable();
        $driver = $connection->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            $rows = $connection->select('SHOW COLUMNS FROM `'.str_replace('`', '', $table).'`');
            $declared = [];
            foreach ($rows as $row) {
                $row = (array) $row;
                $declared[$row['Field'] ?? $row['field']] = (string) ($row['Type'] ?? $row['type']);
            }
        } elseif ($driver === 'sqlite') {
            $declared = [];
            foreach ($connection->select('PRAGMA table_info("'.str_replace('"', '', $table).'")') as $row) {
                $row = (array) $row;
                $declared[$row['name']] = (string) $row['type'];
            }
        } else {
            // Not a driver this was written for: offer nothing rather than guess at types.
            return [];
        }

        return array_map(fn (string $type) => self::parseColumnType($type), $declared);
    }

    /**
     * Parses a database column type such as `varchar(255)`, `int(10) unsigned`, `decimal(10,2)` or
     * `enum('a','b')` into its base type, length and (for enums) allowed values.
     *
     * @return array{type: string, length: int|null, enum: list<string>|null}
     */
    public static function parseColumnType(string $declared): array
    {
        $declared = strtolower(trim($declared));
        if (! preg_match('/^([a-z]+)\s*(?:\((.*)\))?/s', $declared, $matches)) {
            return ['type' => $declared, 'length' => null, 'enum' => null];
        }

        $base = $matches[1];
        $args = $matches[2] ?? '';

        if ($base === 'enum') {
            return ['type' => 'enum', 'length' => null, 'enum' => array_values(str_getcsv($args, ',', "'"))];
        }

        return [
            'type' => $base,
            'length' => ctype_digit($args) && $args !== '' ? (int) $args : null,
            'enum' => null,
        ];
    }

    private function isBlocked(string $column): bool
    {
        if (in_array($column, self::BLOCKED, true)) {
            return true;
        }
        foreach (self::BLOCKED_SUFFIXES as $suffix) {
            if (str_ends_with($column, $suffix)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array{type: string, length: int|null, enum: list<string>|null}  $definition
     * @return array{type: string, options: list<string>|null}|null null when a plain value cannot be written to the column
     */
    private function resolveType(mixed $cast, array $definition): ?array
    {
        $enum = $this->enumClassFromCast($cast);
        if ($enum !== null) {
            return ['type' => 'enum', 'options' => array_map(fn ($case) => (string) $case->value, $enum::cases())];
        }

        if (is_string($cast)) {
            $base = strtolower(explode(':', $cast)[0]);
            if (in_array($base, ['array', 'json', 'collection', 'object'], true)) {
                return null;
            }
            if (in_array($base, ['date', 'datetime', 'immutable_date', 'immutable_datetime'], true)) {
                return ['type' => 'date', 'options' => null];
            }
            if ($base === 'integer' || $base === 'int') {
                return ['type' => 'integer', 'options' => null];
            }
            if ($base === 'boolean' || $base === 'bool') {
                return ['type' => 'boolean', 'options' => null];
            }
        } elseif ($cast !== null) {
            // A custom cast class that is not an enum: its stored shape is unknown, so it is not offered.
            return null;
        }

        // A database enum with no cast: the database itself says what is allowed.
        if ($definition['type'] === 'enum' && $definition['enum'] !== null) {
            return ['type' => 'enum', 'options' => $definition['enum']];
        }

        // tinyint(1) is how MySQL stores a boolean.
        if ($definition['type'] === 'tinyint' && $definition['length'] === 1) {
            return ['type' => 'boolean', 'options' => null];
        }

        return match ($definition['type']) {
            'varchar', 'char', 'string' => ['type' => 'string', 'options' => null],
            'text', 'tinytext', 'mediumtext', 'longtext' => ['type' => 'text', 'options' => null],
            'int', 'integer', 'bigint', 'smallint', 'mediumint', 'tinyint' => ['type' => 'integer', 'options' => null],
            'float', 'double', 'decimal', 'real', 'numeric' => ['type' => 'number', 'options' => null],
            'boolean', 'bool' => ['type' => 'boolean', 'options' => null],
            'date', 'datetime', 'timestamp' => ['type' => 'date', 'options' => null],
            default => null,
        };
    }

    /**
     * @return class-string<\BackedEnum>|null
     */
    private function enumClassFromCast(mixed $cast): ?string
    {
        if (! is_string($cast)) {
            return null;
        }
        if (enum_exists($cast) && is_subclass_of($cast, \BackedEnum::class)) {
            return $cast;
        }
        // App\Casts\NullableEnumCast:App\Enums\Salutation
        if (str_contains($cast, ':')) {
            $candidate = explode(':', $cast, 2)[1];
            if (enum_exists($candidate) && is_subclass_of($candidate, \BackedEnum::class)) {
                return $candidate;
            }
        }

        return null;
    }
}
