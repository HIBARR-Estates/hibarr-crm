<div class="row">
    <div class="col-md-12">
        <div class="card border-0 b-shadow-4 mb-3 e-d-info">
            <x-cards.data :title="__('performance::app.objectiveCheckIns')" padding="false" otherClasses="h-200">
                <x-table>
                    <x-slot name="thead">
                        <th>@lang('performance::app.objectiveTitle')</th>
                        <th>@lang('performance::app.pendingCheckIns')</th>
                        <th>@lang('performance::app.upcomingCheckIns')</th>
                        <th class="text-right pr-20">@lang('app.action')</th>
                    </x-slot>
                    @forelse ($checkInstats as $checkInStats)
                        <tr>
                            <td>
                                {{ $checkInStats['objective_title'] }}
                            </td>
                            <td>{{ $checkInStats['pending'] }}</td>
                            <td>{{ $checkInStats['upcoming'] }}</td>
                            <td class="text-right pr-20" width="5%">
                                <a href="javascript:;" class="btn btn-secondary f-14 sendCheckInReminder" data-toggle="tooltip"
                                    data-objective-id="{{ $checkInStats['objective_id'] }}" data-type="objective"
                                    data-original-title="@lang('performance::modules.sendReminderObjective')"><i class="fa fa-paper-plane mr-2"></i>
                                </a>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="6" class="shadow-none">
                                <x-cards.no-record icon="tasks" :message="__('messages.noRecordFound')" />
                            </td>
                        </tr>
                    @endforelse
                </x-table>
            </x-cards.data>
        </div>
    </div>
</div>
