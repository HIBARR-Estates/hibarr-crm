<?php

namespace App\Http\Middleware;

use App\Enums\CrmEventSource;
use App\Services\CrmEventService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * After-middleware for declarative CRM event recording.
 *
 * Apply to routes that should automatically log an event on successful completion.
 * The event type can be specified via:
 *   1. Route parameter: Route::post(...)->middleware('crm.event:deal_created')
 *   2. Request header: X-CRM-EVENT-TYPE
 *
 * Optional headers:
 *   - X-CRM-BUSINESS-RULE-ID: Associate the event with a business rule.
 *   - X-CRM-CORRELATION-ID: Link the event to a correlation chain.
 *   - X-CRM-CAUSATION-ID: Link to a direct parent event.
 *
 * The middleware captures IP address and user agent automatically.
 *
 * Usage in routes:
 *   Route::post('deals', [DealController::class, 'store'])
 *       ->middleware('crm.event:deal_created');
 */
class CrmEventMiddleware
{
    public function __construct(
        protected CrmEventService $eventService
    ) {}

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, ?string $eventTypeSlug = null): Response
    {
        $response = $next($request);

        // Only record events on successful responses (2xx)
        if ($response->getStatusCode() >= 200 && $response->getStatusCode() < 300) {
            $this->recordEvent($request, $response, $eventTypeSlug);
        }

        return $response;
    }

    /**
     * Record the CRM event after a successful response.
     */
    protected function recordEvent(Request $request, Response $response, ?string $eventTypeSlug): void
    {
        // Resolve event type slug
        $slug = $eventTypeSlug
            ?? $request->header('X-CRM-EVENT-TYPE');

        if (!$slug) {
            return;
        }

        // Resolve company ID
        $companyId = $request->header('X-COMPANY-ID')
            ?? (auth()->check() ? (auth()->user()->company_id ?? null) : null);

        if (!$companyId) {
            return;
        }

        // Attempt to extract model info from the response or route
        $modelType = null;
        $modelId = null;

        // Try route parameters first
        if ($request->route()) {
            // Common route parameter patterns
            foreach (['id', 'deal', 'lead', 'property', 'task', 'contact'] as $param) {
                $value = $request->route($param);
                if ($value && is_numeric($value)) {
                    $modelId = (int) $value;
                    break;
                }
                if ($value && is_object($value) && method_exists($value, 'getKey')) {
                    $modelType = get_class($value);
                    $modelId = $value->getKey();
                    break;
                }
            }
        }

        // Build event params
        $params = [
            'event_type_slug' => $slug,
            'company_id' => (int) $companyId,
            'user_id' => auth()->id(),
            'model_type' => $modelType ?? $request->header('X-CRM-MODEL-TYPE'),
            'model_id' => $modelId ?? $request->header('X-CRM-MODEL-ID'),
            'generation_type' => auth()->check() ? 'user_generated' : 'system_generated',
            'source' => CrmEventSource::MIDDLEWARE->value,
            'correlation_id' => $request->header('X-CRM-CORRELATION-ID'),
            'causation_id' => $request->header('X-CRM-CAUSATION-ID'),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'metadata' => [
                'method' => $request->method(),
                'url' => $request->fullUrl(),
                'status_code' => $response->getStatusCode(),
            ],
        ];

        try {
            $this->eventService->record($params);
        } catch (\Throwable $e) {
            // Never let event recording break the response
            \Illuminate\Support\Facades\Log::warning('CrmEventMiddleware — Failed to record event.', [
                'slug' => $slug,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
