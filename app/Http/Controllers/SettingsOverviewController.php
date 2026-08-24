<?php

namespace App\Http\Controllers;

use Inertia\Inertia;

/**
 * Admin-only React settings hub — one card per entity (leads, deals,
 * meetings, tasks, notes, reminders, automation). Most individual settings
 * views (e.g. task categories) render inline as a drawer on this page;
 * larger ones (e.g. automation) get their own full-page route instead.
 */
class SettingsOverviewController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();

        $this->middleware(function ($request, $next) {
            abort_403(!in_array('admin', user_roles()));
            return $next($request);
        });
    }

    public function index()
    {
        return Inertia::render('Settings/Index', [
            'pageTitle' => __('app.menu.settings'),
        ]);
    }
}
