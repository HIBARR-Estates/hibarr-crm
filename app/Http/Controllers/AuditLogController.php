<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Throwable;

/**
 * Settings → Audit log: every recorded create / update / delete / restore and
 * sign-in event (see App\Support\AuditLog\AuditRecorder), filterable by who,
 * what, which record, where from and when. Admin-only, like the settings hub
 * it is reached from.
 *
 * The page ships with no rows: filter options are deferred and entries are
 * fetched page by page from `entries()`, so a large log never blocks paint.
 */
class AuditLogController extends AccountBaseController
{
    public const EVENTS = ['created', 'updated', 'deleted', 'restored', 'login', 'logout', 'login_failed', 'password_reset'];

    public const SOURCES = ['web', 'api', 'console', 'queue'];

    /** Records that have a detail page, so a row can link straight to it. */
    private const RECORD_ROUTES = [
        'App\\Models\\Deal' => 'deals.show',
        'App\\Models\\Lead' => 'lead-contact.show',
        'App\\Models\\Task' => 'tasks.show',
        'App\\Models\\Property' => 'properties.show',
    ];

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.auditLog.title';

        $this->middleware(function ($request, $next) {
            abort_403(! in_array('admin', user_roles()));

            return $next($request);
        });
    }

    public function index()
    {
        $companyId = company()?->id;

        return Inertia::render('Settings/AuditLog/Index', [
            'pageTitle' => __('app.auditLog.title'),
            'events' => self::EVENTS,
            'sources' => self::SOURCES,
            'filterOptions' => Inertia::defer(fn () => [
                'users' => AuditLog::query()
                    ->visibleToCompany($companyId)
                    ->whereNotNull('user_id')
                    ->selectRaw('user_id, MAX(user_name) as user_name')
                    ->groupBy('user_id')
                    ->get()
                    ->map(fn ($row) => ['id' => (int) $row->user_id, 'name' => $row->user_name ?: "#{$row->user_id}"])
                    ->sortBy(fn ($u) => Str::lower($u['name']))
                    ->values(),
                'types' => AuditLog::query()
                    ->visibleToCompany($companyId)
                    ->select('auditable_type')
                    ->distinct()
                    ->pluck('auditable_type')
                    ->map(fn ($type) => ['value' => $type, 'label' => self::typeLabel($type)])
                    ->sortBy('label')
                    ->values(),
            ]),
        ]);
    }

    public function entries(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'users' => ['nullable', 'array'],
            'users.*' => ['integer', 'min:0'],
            'events' => ['nullable', 'array'],
            'events.*' => ['string', 'in:'.implode(',', self::EVENTS)],
            'types' => ['nullable', 'array'],
            'types.*' => ['string', 'max:255'],
            'sources' => ['nullable', 'array'],
            'sources.*' => ['string', 'in:'.implode(',', self::SOURCES)],
            'record_id' => ['nullable', 'string', 'max:64'],
            'search' => ['nullable', 'string', 'max:255'],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = AuditLog::query()->visibleToCompany(company()?->id);
        $this->applyFilters($query, $validated);

        $paginator = $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate((int) ($validated['per_page'] ?? 25));

        return response()->json([
            'data' => collect($paginator->items())->map(fn (AuditLog $log) => $this->present($log))->values(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    private function applyFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['users'])) {
            $ids = array_map('intval', $filters['users']);
            // 0 stands for "System" — changes made with nobody signed in.
            $withSystem = in_array(0, $ids, true);
            $ids = array_values(array_filter($ids));

            $query->where(function (Builder $q) use ($ids, $withSystem) {
                if ($ids) {
                    $q->whereIn('user_id', $ids);
                }
                if ($withSystem) {
                    $q->orWhereNull('user_id');
                }
            });
        }

        if (! empty($filters['events'])) {
            $query->whereIn('event', $filters['events']);
        }

        if (! empty($filters['types'])) {
            $query->whereIn('auditable_type', $filters['types']);
        }

        if (! empty($filters['sources'])) {
            $query->whereIn('source', $filters['sources']);
        }

        if (! empty($filters['record_id'])) {
            $query->where('auditable_id', $filters['record_id']);
        }

        if (! empty($filters['search'])) {
            $term = '%'.addcslashes($filters['search'], '%_\\').'%';
            $query->where(function (Builder $q) use ($term) {
                $q->where('auditable_label', 'like', $term)
                    ->orWhere('user_name', 'like', $term)
                    ->orWhere('origin', 'like', $term)
                    ->orWhere('ip_address', 'like', $term);
            });
        }

        // Days are the company's calendar days; rows are stored in app time.
        $timezone = $this->companyTimezone();

        if (! empty($filters['date_from'])) {
            $query->where('created_at', '>=', Carbon::parse($filters['date_from'], $timezone)->startOfDay()->setTimezone(config('app.timezone')));
        }

        if (! empty($filters['date_to'])) {
            $query->where('created_at', '<=', Carbon::parse($filters['date_to'], $timezone)->endOfDay()->setTimezone(config('app.timezone')));
        }
    }

    private function present(AuditLog $log): array
    {
        return [
            'id' => $log->id,
            'event' => $log->event,
            'created_at' => $log->created_at?->toIso8601String(),
            'user' => $log->user_id || $log->user_name
                ? ['id' => $log->user_id, 'name' => $log->user_name ?: "#{$log->user_id}"]
                : null,
            'auditable' => [
                'type' => $log->auditable_type,
                'type_label' => self::typeLabel($log->auditable_type),
                'id' => $log->auditable_id,
                'label' => $log->auditable_label,
                'url' => $this->recordUrl($log),
            ],
            'old_values' => $log->old_values,
            'new_values' => $log->new_values,
            'source' => $log->source,
            'ip_address' => $log->ip_address,
            'user_agent' => $log->user_agent,
            'http_method' => $log->http_method,
            'origin' => $log->origin,
        ];
    }

    /** "App\Models\DealFollowUp" → "Deal Follow Up". */
    public static function typeLabel(string $type): string
    {
        return Str::headline(class_basename($type));
    }

    private function recordUrl(AuditLog $log): ?string
    {
        $route = self::RECORD_ROUTES[$log->auditable_type] ?? null;

        if (! $route || ! $log->auditable_id || $log->event === 'deleted' || ! Route::has($route)) {
            return null;
        }

        try {
            return route($route, $log->auditable_id);
        } catch (Throwable) {
            return null;
        }
    }

    private function companyTimezone(): string
    {
        $timezone = company()?->timezone;

        return is_string($timezone) && in_array($timezone, timezone_identifiers_list(), true)
            ? $timezone
            : config('app.timezone');
    }
}
