@if (session()->has(\App\Services\EmployeeImpersonationService::SESSION_ID))
    <div role="status" style="position: sticky; top: 63px; z-index: 20; display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap; background: #fffbeb; color: #b45309; border-bottom: 1px solid #fde68a; padding: 10px 16px; font-size: 14px; font-weight: 500;">
        <span>{{ __('app.impersonation.banner', ['name' => user()->name]) }}</span>
        <form method="POST" action="{{ route('impersonation.leave') }}" style="margin: 0;">
            @csrf
            <button type="submit" class="btn btn-warning btn-sm f-13">
                @lang('app.impersonation.return')
            </button>
        </form>
    </div>
@endif
