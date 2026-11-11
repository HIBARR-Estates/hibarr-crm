<?php

namespace App\Services\Migration;

use App\Models\Deal;
use App\Models\Lead;
use App\Services\LeadContactMethodService;
use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Read-only aggregate inventory for CRM → OL migration sizing (ADR-0007).
 * Uses query builder only — no Eloquent models for counting.
 */
class CrmInventoryReportBuilder
{
    public const REPORT_VERSION = 1;

    private Connection $db;

    private string $connectionName;

    private ?int $companyId;

    /** @var list<string> */
    private array $warnings = [];

    /** @var array<string, int> */
    private array $timingsMs = [];

    /** @var array<string, array{key: string, metrics: array<string, int|float|array<string, int>>, notes?: string|null}> */
    private array $entityMetricsByKey = [];

    public function __construct(string $connectionName, ?int $companyId = null)
    {
        $this->connectionName = $connectionName;
        $this->companyId = $companyId;
        $this->db = DB::connection($connectionName);
    }

    /**
     * @param  list<string>  $sections  entities|duplicates|usage
     * @return array<string, mixed>
     */
    public function build(array $sections, string $environment): array
    {
        $wantEntities = in_array('entities', $sections, true);
        $wantDuplicates = in_array('duplicates', $sections, true);
        $wantUsage = in_array('usage', $sections, true);

        $entities = [];
        $duplicates = [];
        $usage = [];

        if ($wantEntities || $wantUsage) {
            $entities = $this->timed('entities', fn () => $this->buildEntities());
            foreach ($entities as $row) {
                $this->entityMetricsByKey[$row['key']] = $row;
            }
        }

        if ($wantDuplicates) {
            $duplicates = $this->timed('duplicates', fn () => $this->buildDuplicates());
        }

        if ($wantUsage) {
            $usage = $this->timed('usage', fn () => $this->buildUsage());
        }

        $host = (string) (config("database.connections.{$this->connectionName}.host") ?? '');

        return [
            'system' => 'crm',
            'report_version' => self::REPORT_VERSION,
            'environment' => $environment,
            'generated_at' => now()->toIso8601String(),
            'database' => [
                'connection' => $this->connectionName,
                'host' => $host,
            ],
            'scope' => [
                'company_id' => $this->companyId,
            ],
            'entities' => $wantEntities ? $entities : [],
            'duplicates' => $duplicates,
            'usage' => $usage,
            'warnings' => $this->warnings,
            'timings_ms' => $this->timingsMs,
        ];
    }

    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    private function timed(string $label, callable $callback): mixed
    {
        $start = hrtime(true);
        try {
            return $callback();
        } finally {
            $this->timingsMs[$label] = (int) round((hrtime(true) - $start) / 1_000_000);
        }
    }

    /**
     * @return list<array{key: string, metrics: array<string, int|float|array<string, int>>, notes?: string|null}>
     */
    private function buildEntities(): array
    {
        $rows = [];

        $rows[] = $this->countLeads();
        $rows[] = $this->simpleTotal('deals', 'deals');
        $rows[] = $this->countContactMethods();
        $rows[] = $this->countTasks();
        $followUps = $this->simpleTotal('deal_follow_ups', 'lead_follow_up');
        $rows[] = $followUps;
        if ($followUps !== null) {
            $rows[] = [
                'key' => 'meetings',
                'metrics' => $followUps['metrics'],
                'notes' => 'product meetings = DealFollowUp (lead_follow_up); not a separate volume',
            ];
        }
        $rows[] = $this->countReminders();
        $rows[] = $this->countNotes();
        $rows[] = $this->countFiles();
        $rows[] = $this->simpleTotal('custom_field_values', 'custom_fields_data');
        $rows[] = $this->countCustomFields();
        $rows[] = $this->countQualifications();
        $rows[] = $this->simpleTotal('partner_agents', 'lead_agents');
        $rows[] = $this->countAgentTree();
        $rows[] = $this->simpleTotal('mlm_levels', 'mlm_levels');
        $rows[] = $this->simpleTotal('mlm_cycles', 'mlm_cycles');
        $rows[] = $this->simpleTotal('mlm_commissions', 'mlm_commissions');
        $rows[] = $this->simpleTotal('mlm_disputes', 'mlm_commission_disputes');
        $rows[] = $this->simpleTotal('partner_flags', 'partner_flags');
        $legacy = $this->simpleTotal('legacy_commissions', 'commissions');
        $legacy['notes'] = 'legacy employee commission path; prefer mlm_commissions for Hibarr MLM';
        $rows[] = $legacy;

        return array_values(array_filter($rows));
    }

    /**
     * @return array{key: string, metrics: array<string, int>, notes?: string|null}|null
     */
    private function countLeads(): ?array
    {
        if (! $this->tableExists('leads')) {
            return null;
        }

        $active = $this->scoped('leads')->whereNull('deleted_at')->count();
        $softDeleted = $this->scoped('leads')->whereNotNull('deleted_at')->count();
        $merged = $this->scoped('leads')
            ->whereNotNull('merged_into_lead_id')
            ->count();

        return [
            'key' => 'leads',
            'metrics' => [
                'active' => $active,
                'soft_deleted' => $softDeleted,
                'merged' => $merged,
                'total_including_trashed' => $active + $softDeleted,
            ],
        ];
    }

    /**
     * @return array{key: string, metrics: array<string, int>, notes?: string|null}|null
     */
    private function simpleTotal(string $key, string $table): ?array
    {
        if (! $this->tableExists($table)) {
            return null;
        }

        return [
            'key' => $key,
            'metrics' => [
                'total' => $this->scoped($table)->count(),
            ],
        ];
    }

    /**
     * @return array{key: string, metrics: array<string, int>, notes?: string|null}|null
     */
    private function countContactMethods(): ?array
    {
        if (! $this->tableExists('lead_contact_methods')) {
            return null;
        }

        $q = $this->scoped('lead_contact_methods');
        $total = (clone $q)->count();
        $email = (clone $q)->where('type', 'email')->count();
        $phone = (clone $q)->where('type', 'phone')->count();

        return [
            'key' => 'contact_methods',
            'metrics' => [
                'total' => $total,
                'email' => $email,
                'phone' => $phone,
            ],
        ];
    }

    /**
     * @return array{key: string, metrics: array<string, int>, notes?: string|null}|null
     */
    private function countTasks(): ?array
    {
        if (! $this->tableExists('tasks')) {
            return null;
        }

        $active = $this->scoped('tasks')->whereNull('deleted_at')->count();
        $softDeleted = $this->scoped('tasks')->whereNotNull('deleted_at')->count();

        $crmLinked = 0;
        if ($this->tableExists('taskables')) {
            $leadMorph = (new Lead)->getMorphClass();
            $dealMorph = (new Deal)->getMorphClass();
            $crmLinked = (int) $this->db->table('taskables')
                ->whereIn('taskable_type', [$leadMorph, $dealMorph])
                ->distinct()
                ->count('task_id');
        }

        return [
            'key' => 'tasks',
            'metrics' => [
                'active' => $active,
                'soft_deleted' => $softDeleted,
                'crm_linked' => $crmLinked,
            ],
        ];
    }

    /**
     * @return array{key: string, metrics: array<string, int|array<string, int>>, notes?: string|null}|null
     */
    private function countReminders(): ?array
    {
        if (! $this->tableExists('reminders')) {
            return null;
        }

        $total = $this->scoped('reminders')->count();
        $byStatus = [];
        $rows = $this->scoped('reminders')
            ->select('status', $this->db->raw('COUNT(*) as c'))
            ->groupBy('status')
            ->get();
        foreach ($rows as $row) {
            $status = (string) ($row->status ?? 'unknown');
            $byStatus[$status] = (int) $row->c;
        }

        return [
            'key' => 'reminders',
            'metrics' => [
                'total' => $total,
                'by_status' => $byStatus,
            ],
        ];
    }

    /**
     * @return array{key: string, metrics: array<string, int>, notes?: string|null}|null
     */
    private function countNotes(): ?array
    {
        $leadNotes = $this->tableExists('lead_notes') ? $this->scoped('lead_notes')->count() : null;
        $dealNotes = $this->tableExists('deal_notes') ? $this->scoped('deal_notes')->count() : null;

        if ($leadNotes === null && $dealNotes === null) {
            $this->warnMissing('lead_notes');
            $this->warnMissing('deal_notes');

            return null;
        }

        $leadNotes = $leadNotes ?? 0;
        $dealNotes = $dealNotes ?? 0;

        return [
            'key' => 'notes',
            'metrics' => [
                'lead_notes' => $leadNotes,
                'deal_notes' => $dealNotes,
                'total' => $leadNotes + $dealNotes,
            ],
        ];
    }

    /**
     * @return array{key: string, metrics: array<string, int>, notes?: string|null}|null
     */
    private function countFiles(): ?array
    {
        $leadFiles = $this->tableExists('lead_contact_files') ? $this->scoped('lead_contact_files')->count() : null;
        $dealFiles = $this->tableExists('deal_files') ? $this->scoped('deal_files')->count() : null;

        if ($leadFiles === null && $dealFiles === null) {
            $this->warnMissing('lead_contact_files');
            $this->warnMissing('deal_files');

            return null;
        }

        $leadFiles = $leadFiles ?? 0;
        $dealFiles = $dealFiles ?? 0;

        return [
            'key' => 'files',
            'metrics' => [
                'lead_contact_files' => $leadFiles,
                'deal_files' => $dealFiles,
                'total' => $leadFiles + $dealFiles,
            ],
        ];
    }

    /**
     * @return array{key: string, metrics: array<string, int>, notes?: string|null}|null
     */
    private function countCustomFields(): ?array
    {
        if (! $this->tableExists('custom_fields')) {
            return null;
        }

        $definitionsTotal = $this->scoped('custom_fields')->count();
        $withValues = 0;

        if ($this->tableExists('custom_fields_data')) {
            $withValuesQuery = $this->db->table('custom_fields_data')
                ->select('custom_field_id')
                ->distinct();

            if ($this->companyId !== null && $this->hasColumn('custom_fields', 'company_id')) {
                $fieldIds = $this->scoped('custom_fields')->pluck('id');
                $withValuesQuery->whereIn('custom_field_id', $fieldIds);
            }

            try {
                $withValues = $withValuesQuery->get()->count();
            } catch (Throwable) {
                $withValues = 0;
                $this->warnings[] = 'custom_fields: failed to count definitions_with_any_value';
            }
        }

        return [
            'key' => 'custom_fields',
            'metrics' => [
                'definitions_total' => $definitionsTotal,
                'definitions_with_any_value' => $withValues,
                'definitions_empty' => max(0, $definitionsTotal - $withValues),
            ],
        ];
    }

    /**
     * @return array{key: string, metrics: array<string, int>, notes?: string|null}|null
     */
    private function countQualifications(): ?array
    {
        if (! $this->tableExists('lead_qualification_answers')) {
            return null;
        }

        $answers = $this->scoped('lead_qualification_answers')->count();
        $runs = $this->tableExists('lead_qualifications')
            ? $this->scoped('lead_qualifications')->count()
            : 0;

        return [
            'key' => 'qualification_answers',
            'metrics' => [
                'total' => $answers,
                'qualification_runs' => $runs,
            ],
        ];
    }

    /**
     * @return array{key: string, metrics: array<string, int>, notes?: string|null}|null
     */
    private function countAgentTree(): ?array
    {
        if (! $this->tableExists('agent_hierarchy')) {
            return null;
        }

        $edges = $this->scoped('agent_hierarchy')->count();

        $ancestors = $this->scoped('agent_hierarchy')->distinct()->pluck('ancestor_id');
        $descendants = $this->scoped('agent_hierarchy')->distinct()->pluck('descendant_id');
        $distinct = $ancestors->merge($descendants)->unique()->count();

        return [
            'key' => 'agent_tree',
            'metrics' => [
                'edges' => $edges,
                'distinct_agents' => $distinct,
            ],
        ];
    }

    /**
     * @return list<array{key: string, metrics: array<string, int>, notes?: string|null}>
     */
    private function buildDuplicates(): array
    {
        if (! $this->tableExists('lead_contact_methods')) {
            return [];
        }

        return [
            $this->duplicateGroups('people_by_email', 'email'),
            $this->duplicateGroups('people_by_phone', 'phone'),
        ];
    }

    /**
     * @return array{key: string, metrics: array<string, int>, notes?: string|null}
     */
    private function duplicateGroups(string $key, string $type): array
    {
        $prefix = LeadContactMethodService::INVALIDATED_PREFIX;

        $base = $this->scoped('lead_contact_methods')
            ->where('type', $type)
            ->whereNotNull('normalized')
            ->where('normalized', '!=', '')
            ->where('normalized', 'not like', $prefix.'%');

        $grouped = (clone $base)
            ->select('normalized', $this->db->raw('COUNT(DISTINCT lead_id) as lead_count'))
            ->groupBy('normalized')
            ->havingRaw('COUNT(DISTINCT lead_id) > 1')
            ->get();

        $duplicateGroups = $grouped->count();
        $extraRows = (int) $grouped->sum(fn ($row) => max(0, ((int) $row->lead_count) - 1));

        return [
            'key' => $key,
            'metrics' => [
                'duplicate_groups' => $duplicateGroups,
                'extra_rows' => $extraRows,
            ],
        ];
    }

    /**
     * @return list<array{key: string, metrics: array<string, int|float>, notes?: string|null}>
     */
    private function buildUsage(): array
    {
        $usage = [];

        $zeroRowKeys = [
            'partner_agents',
            'agent_tree',
            'mlm_levels',
            'mlm_cycles',
            'mlm_commissions',
            'mlm_disputes',
            'partner_flags',
            'legacy_commissions',
        ];

        foreach ($zeroRowKeys as $key) {
            $row = $this->entityMetricsByKey[$key] ?? null;
            if ($row === null) {
                continue;
            }
            $total = (int) ($row['metrics']['total'] ?? $row['metrics']['edges'] ?? 0);
            if ($total === 0) {
                $usage[] = [
                    'key' => "zero_rows_{$key}",
                    'metrics' => ['count' => 0],
                    'notes' => "{$key} has zero rows — candidate unused/abandoned for migration scope",
                ];
            }
        }

        $cf = $this->entityMetricsByKey['custom_fields'] ?? null;
        if ($cf !== null) {
            $usage[] = [
                'key' => 'custom_fields_empty',
                'metrics' => [
                    'count' => (int) ($cf['metrics']['definitions_empty'] ?? 0),
                    'of_total' => (int) ($cf['metrics']['definitions_total'] ?? 0),
                    'definitions_with_any_value' => (int) ($cf['metrics']['definitions_with_any_value'] ?? 0),
                ],
                'notes' => 'custom field definitions with no values in custom_fields_data',
            ];
        }

        $gap = $this->contactMethodsBackfillGap();
        if ($gap !== null) {
            $usage[] = $gap;
        }

        return $usage;
    }

    /**
     * @return array{key: string, metrics: array<string, int>, notes?: string|null}|null
     */
    private function contactMethodsBackfillGap(): ?array
    {
        if (! $this->tableExists('leads') || ! $this->tableExists('lead_contact_methods')) {
            return null;
        }

        $leads = $this->scoped('leads')->whereNull('deleted_at');

        $withContact = (clone $leads)->where(function (Builder $q) {
            $q->where(function (Builder $inner) {
                $inner->whereNotNull('client_email')->where('client_email', '!=', '');
            })->orWhere(function (Builder $inner) {
                $inner->whereNotNull('mobile')->where('mobile', '!=', '');
            });
        });

        $gap = (clone $withContact)
            ->whereNotIn('id', $this->db->table('lead_contact_methods')->select('lead_id')->distinct())
            ->count();

        return [
            'key' => 'contact_methods_backfill_gap',
            'metrics' => [
                'leads_with_email_or_mobile_but_no_contact_method' => $gap,
            ],
            'notes' => 'signals leads:sync-contact-methods backfill debt',
        ];
    }

    private function scoped(string $table): Builder
    {
        $query = $this->db->table($table);

        if ($this->companyId === null) {
            return $query;
        }

        if (! $this->hasColumn($table, 'company_id')) {
            $message = "company scope skipped for {$table}: no company_id column";
            if (! in_array($message, $this->warnings, true)) {
                $this->warnings[] = $message;
            }

            return $query;
        }

        return $query->where('company_id', $this->companyId);
    }

    private function tableExists(string $table): bool
    {
        if (Schema::connection($this->connectionName)->hasTable($table)) {
            return true;
        }

        $this->warnMissing($table);

        return false;
    }

    private function warnMissing(string $table): void
    {
        $message = "table missing: {$table}";
        if (! in_array($message, $this->warnings, true)) {
            $this->warnings[] = $message;
        }
    }

    private function hasColumn(string $table, string $column): bool
    {
        return Schema::connection($this->connectionName)->hasColumn($table, $column);
    }
}
