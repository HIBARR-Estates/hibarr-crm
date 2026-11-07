<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\CompanyDashboardViewer;
use App\Models\User;
use App\Scopes\ActiveScope;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Settings → Company dashboard access: the list of people who may open the
 * Company dashboard. Admins manage it; being an admin does not put anyone on
 * it (see CompanyDashboardAccess).
 */
class CompanyDashboardAccessController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'pages.company_dashboard_access.title';

        $this->middleware(function ($request, $next) {
            self::ensureAdmin();

            return $next($request);
        });
    }

    /** Only admins manage the list (being on it is a separate thing). */
    public static function ensureAdmin(): void
    {
        abort_403(! in_array('admin', user_roles()));
    }

    public function index()
    {
        return Inertia::render('Settings/CompanyDashboardAccess', [
            'pageTitle' => __('pages.company_dashboard_access.title'),
            'viewers' => $this->viewers(),
            // Everyone who could be added; only needed once the picker opens.
            'people' => Inertia::defer(fn () => User::withoutGlobalScope(ActiveScope::class)
                ->where('company_id', company()->id)
                ->where('status', 'active')
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'image'])
                ->map(fn (User $user) => [
                    'id' => (int) $user->id,
                    'name' => $user->name,
                    'designation' => $user->email,
                    'image' => $user->image_url,
                ])
                ->values()),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'user_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->where('company_id', company()->id),
            ],
        ]);

        CompanyDashboardViewer::query()->firstOrCreate(
            ['company_id' => company()->id, 'user_id' => (int) $data['user_id']],
            ['added_by' => user()->id],
        );

        return Reply::successWithData(__('messages.recordSaved'), ['viewers' => $this->viewers()]);
    }

    public function destroy(int $userId)
    {
        CompanyDashboardViewer::query()
            ->where('company_id', company()->id)
            ->where('user_id', $userId)
            ->delete();

        return Reply::successWithData(__('messages.deleteSuccess'), ['viewers' => $this->viewers()]);
    }

    /** @return list<array{user_id: int, name: string, email: string|null, image: string|null, added_at: string|null}> */
    private function viewers(): array
    {
        /** @var \Illuminate\Database\Eloquent\Collection<int, CompanyDashboardViewer> $rows */
        $rows = CompanyDashboardViewer::query()
            ->where('company_id', company()->id)
            ->with('user:id,name,email,image,status')
            ->get();

        return $rows
            ->filter(fn (CompanyDashboardViewer $viewer) => $viewer->user !== null)
            ->sortBy(fn (CompanyDashboardViewer $viewer) => mb_strtolower($viewer->user->name))
            ->map(fn (CompanyDashboardViewer $viewer) => [
                'user_id' => (int) $viewer->user_id,
                'name' => $viewer->user->name,
                'email' => $viewer->user->email,
                'image' => $viewer->user->image_url,
                'active' => $viewer->user->status === 'active',
                'added_at' => $viewer->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();
    }
}
