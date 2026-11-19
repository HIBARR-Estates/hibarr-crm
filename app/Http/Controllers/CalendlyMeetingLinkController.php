<?php

namespace App\Http\Controllers;

use App\Models\CalendlyMeetingLink;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Settings → Meetings → Calendly booking links.
 *
 * Admins decide which Calendly links the schedule-meeting modal offers and
 * which roles see each one.
 * What the modal itself reads is CalendlyMeetingLinkOptionsController.
 */
class CalendlyMeetingLinkController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();

        $this->middleware(function ($request, $next) {
            abort_403(user()->permission('manage_company_setting') !== 'all');

            return $next($request);
        });
    }

    public function page()
    {
        return Inertia::render('Settings/CalendlyMeetingLinks', [
            'pageTitle' => __('app.menu.meetings'),
            'config' => Inertia::defer(fn () => $this->configData()),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());

        $link = new CalendlyMeetingLink;
        $link->fill($this->normalized($data));
        $link->company_id = company()->id;
        $link->sort_order = (int) CalendlyMeetingLink::max('sort_order') + 1;
        $link->save();

        return response()->json(['status' => 'success', 'data' => $this->serialize($link)], 201);
    }

    public function update(Request $request, int $link): JsonResponse
    {
        $model = CalendlyMeetingLink::findOrFail($link);
        // `sometimes`: the row switch sends only is_active, and must not write
        // back name/url/roles from a page that may have gone stale.
        $model->fill($this->normalized($request->validate($this->rules(partial: true))));
        $model->save();

        return response()->json(['status' => 'success', 'data' => $this->serialize($model)]);
    }

    public function destroy(int $link): JsonResponse
    {
        CalendlyMeetingLink::findOrFail($link)->delete();

        return response()->json(['status' => 'success']);
    }

    /**
     * @return array<string, mixed>
     */
    private function configData(): array
    {
        return [
            'links' => CalendlyMeetingLink::orderBy('sort_order')->orderBy('id')->get()
                ->map(fn (CalendlyMeetingLink $link) => $this->serialize($link))->values()->all(),
            'roles' => Role::where('name', '!=', 'client')->orderBy('id')->get(['id', 'name', 'display_name'])
                ->map(fn (Role $role) => [
                    'id' => $role->id,
                    'name' => $role->display_name ?: $role->name,
                ])->values()->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(CalendlyMeetingLink $link): array
    {
        return [
            'id' => $link->id,
            'name' => $link->name,
            'description' => $link->description,
            'url' => $link->url,
            'role_ids' => array_map('intval', $link->role_ids ?? []),
            'is_active' => $link->is_active,
            'sort_order' => $link->sort_order,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalized(array $data): array
    {
        if (isset($data['url'])) {
            $data['url'] = trim($data['url']);
        }

        // Only when sent: a request that leaves roles out leaves them alone.
        if (array_key_exists('role_ids', $data)) {
            $roleIds = array_values(array_unique(array_map('intval', $data['role_ids'] ?? [])));
            // No roles chosen means everyone: stored as null rather than `[]`.
            $data['role_ids'] = $roleIds === [] ? null : $roleIds;
        }

        return $data;
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(bool $partial = false): array
    {
        $companyId = company()->id;
        $required = $partial ? ['sometimes', 'required'] : ['required'];

        return [
            'name' => [...$required, 'string', 'max:120'],
            'description' => 'nullable|string|max:255',
            'url' => [...$required, 'string', 'max:500', function (string $attribute, mixed $value, \Closure $fail) {
                if (! self::isCalendlyUrl((string) $value)) {
                    $fail(__('messages.calendlyLinkMustBeCalendly'));
                }
            }],
            'role_ids' => 'nullable|array',
            'role_ids.*' => [
                'integer',
                Rule::exists('roles', 'id')->where(fn ($q) => $q->where('company_id', $companyId)),
            ],
            'is_active' => 'sometimes|boolean',
        ];
    }

    /**
     * Only Calendly's own addresses are accepted: the person's name and email
     * are added to the link when it is opened, so it must not point anywhere
     * else.
     */
    public static function isCalendlyUrl(string $url): bool
    {
        $parts = parse_url(trim($url));

        if (! is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])) {
            return false;
        }

        $host = strtolower($parts['host']);

        return $host === 'calendly.com' || str_ends_with($host, '.calendly.com');
    }
}
