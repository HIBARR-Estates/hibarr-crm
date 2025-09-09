@if($cycle == 'monthly')
    @foreach($results['start_date'] as $index => $result)
        <option @if($month == $index+1) selected
                @endif value="{{ $result }} {{ $results['end_date'][$index] }}"> {{ Carbon\Carbon::parse($result)->translatedFormat('F')}} </option>
    @endforeach
@else
    @foreach($results['start_date'] as $index => $result)
        <option @if($current == $index) selected
                @endif value="{{ $result }} {{ $results['end_date'][$index] }}">
            {{ \Carbon\Carbon::parse($result)->translatedFormat($company->date_format) }} @lang('app.to') {{ \Carbon\Carbon::parse($results['end_date'][$index])->translatedFormat($company->date_format) }} @if($cycle != 'semimonthly')
                (@lang('payroll::app.week')-{{ $index+1 }})
            @endif</option>
    @endforeach
@endif

