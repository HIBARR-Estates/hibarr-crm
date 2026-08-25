<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\MetaEvent;
use App\Support\AutomationV2Feature;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * CRUD for the Meta Events catalog (Settings > Automation > Meta Events) —
 * curated {name, value} pairs a deal_automations "meta_conversion" action
 * picks from, instead of free-typing both fields on every automation.
 */
class MetaEventController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.automation.metaEvents';
        $this->middleware(function ($request, $next) {
            abort_403(! AutomationV2Feature::enabled());

            return user()->permission('manage_company_setting') !== 'all' ? redirect()->route('profile-settings.index') : $next($request);
        });
    }

    /**
     * List every Meta Event, each annotated with the automations currently
     * referencing it by name in a meta_conversion action — so the settings
     * screen can show "used by 3 automations" instead of leaving that
     * relationship invisible.
     */
    public function index(Request $request)
    {
        $events = MetaEvent::allWithUsage();

        if ($request->wantsJson() || $request->expectsJson()) {
            return Reply::dataOnly(['status' => 'success', 'data' => $events]);
        }

        return redirect()->route('settings-automation.index');
    }

    public function store(Request $request)
    {
        $request->validate($this->validationRules());

        $event = MetaEvent::create([
            'company_id' => company()->id,
            'name' => trim($request->name),
            'value' => $request->filled('value') ? $request->value : null,
            'description' => $request->description ?: null,
        ]);

        if ($request->wantsJson() || $request->expectsJson()) {
            return Reply::successWithData(__('messages.recordSaved'), ['data' => $event]);
        }

        return Reply::redirect(route('settings-automation.index'), __('messages.recordSaved'));
    }

    public function update(Request $request, $id)
    {
        $event = MetaEvent::findOrFail($id);

        $request->validate($this->validationRules($event->id));

        $event->update([
            'name' => trim($request->name),
            'value' => $request->filled('value') ? $request->value : null,
            'description' => $request->description ?: null,
        ]);

        if ($request->wantsJson() || $request->expectsJson()) {
            return Reply::successWithData(__('messages.updateSuccess'), ['data' => $event]);
        }

        return Reply::redirect(route('settings-automation.index'), __('messages.updateSuccess'));
    }

    public function destroy($id)
    {
        MetaEvent::findOrFail($id)->delete();

        return Reply::success(__('messages.deleteSuccess'));
    }

    /**
     * @return array<string, mixed>
     */
    protected function validationRules(?int $ignoreId = null): array
    {
        return [
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('meta_events', 'name')->where(fn ($q) => $q->where('company_id', company()->id))->ignore($ignoreId),
            ],
            'value' => 'nullable|numeric|min:0',
            'description' => 'nullable|string|max:255',
        ];
    }
}
