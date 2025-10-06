{{-- Meeting Summary Modal --}}
<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">📝 {{ $summary['meetingType']['name'] ?? (__('modules.meeting.meetingSummaryFor') . ' ' . ($summary['deal']['name'] ?? 'N/A')) }} </h5>
    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    @if($errors->any())
        <div class="alert alert-danger" role="alert">
            {{ $errors->first('error') }}
        </div>
    @else
    <div class="meeting-summary" style="font-size: 16px; padding: 0 7px;">
    {{-- Meeting Information --}}
    <h4 style="font-size: 20px; margin-bottom: 15px;">@lang('modules.meeting.information')</h4>
    <hr>
    
    <p style="margin-bottom: 10px;"><strong>@lang('modules.meeting.deal'):</strong> 
        @if(isset($summary['deal']) && $summary['deal'])
            {{ $summary['deal']['name'] ?? 'N/A' }}
        @else
            @lang('modules.meeting.notLinked')
        @endif
    </p>
    
    <p style="margin-bottom: 20px;"><strong>@lang('modules.meeting.meetingType'):</strong> 
        @if(isset($summary['meetingType']) && $summary['meetingType'])
            {{ $summary['meetingType']['name'] ?? 'N/A' }}
        @else
            @lang('modules.meeting.notSpecified')
        @endif
    </p>

    {{-- Summary Content --}}
    @if(isset($summary['summary_object']) && $summary['summary_object'] !== null && $summary['summary_object'] !== '')
        <h4 style="font-size: 20px; margin-bottom: 15px;">@lang('modules.meeting.title')</h4>
        <hr>
        
        @if(isset($summary['processed_sections']) && !empty($summary['processed_sections']))
            @foreach($summary['processed_sections'] as $section)
                <div style="margin-bottom: 20px; margin-top: 20px; padding: 0 5px;">
                    <p style="margin-bottom: 10px; margin-top: 20px;"><strong>{{ $section['title'] }}:</strong></p>
                    
                    @if(isset($section['content']['type']) && $section['content']['type'] === 'simple')
                        <p style="margin-bottom: 15px; padding-left: 10px;">{{ $section['content']['value'] }}</p>
                    @elseif(isset($section['content']['type']) && $section['content']['type'] === 'list')
                        @foreach($section['content']['items'] as $item)
                            <div style="text-align: justify; margin-bottom: 8px; padding-left: 7px;">
                                <strong>{{ $item['number'] }}.</strong> {{ $item['text'] }}
                            </div>
                        @endforeach
                    @endif  
                </div>
            @endforeach
        @else
            <p><em>@lang('modules.meeting.noSummaryGenerated')</em></p>
        @endif
    @else
        <p><em>@lang('modules.meeting.noSummaryGenerated')</em></p>
    @endif
    </div>
    @endif
</div>
<div class="modal-footer">
    <button type="button" class="btn btn-secondary" data-dismiss="modal">@lang('modules.meeting.close')</button>
</div>
