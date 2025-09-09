<div class="row">
    <div class="col-md-12">
        <div class="card border-0 b-shadow-4 mb-3 e-d-info">
            <x-cards.data :title="__('performance::app.oneOnOnemeetings')" padding="false" otherClasses="h-200">
                <x-table>
                    <x-slot name="thead">
                        <th>@lang('app.menu.employees')</th>
                        <th>@lang('performance::app.totalMeetings')</th>
                        <th>@lang('performance::app.onTimeMeetings')</th>
                        <th>@lang('performance::app.delayedMeetings')</th>
                        <th>@lang('performance::app.pendingMeetings')</th>
                        <th class="text-right pr-20">@lang('app.action')</th>
                    </x-slot>
                    @forelse ($meetings as $meetingBy => $meetingGroup)
                        <tr>
                            <td class="pl-20">
                                @if ($meetingGroup->isNotEmpty() && $meetingGroup[0]->meetingBy)
                                    <x-employee :user="$meetingGroup[0]->meetingBy" />
                                @else
                                    '--'
                                @endif
                            </td>
                            <td>{{ $statistics[$meetingBy]['total'] }}</td>
                            <td>{{ $statistics[$meetingBy]['onTime'] }}</td>
                            <td>{{ $statistics[$meetingBy]['delayed'] }}</td>
                            <td>{{ $statistics[$meetingBy]['pending'] }}</td>
                            <td class="text-right pr-20" width="5%">
                                @if ($statistics[$meetingBy]['pendingIds'])
                                    <a href="javascript:;" class="btn btn-secondary f-14 sendReminder" data-toggle="tooltip"
                                        data-meeting-ids="{{ implode(',', $statistics[$meetingBy]['pendingIds']) }}"
                                        data-original-title="@lang('performance::modules.sendReminderMeeting')"><i class="fa fa-paper-plane mr-2"></i>
                                    </a>
                                @endif
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
