@extends('mail.layouts.base')

@section('title', $moduleLabel . ' Bulk ' . ucfirst($actionLabel) . ' Completed')
@section('notifiableName', $notifiableName)

@section('intro', __($intro))

@section('content')
    @if(!empty($sampleRecords))
        <span style="display:block; background-color:rgba(255,255,255,0.4); border:1px solid rgba(30,64,175,0.15); border-radius:12px; padding:14px;">
            
            @foreach($sampleRecords as $record)
                <a href="{{ $record['url'] }}" target="_blank" rel="noopener" style="display:block; text-decoration:none; margin:0 0 8px 0; padding:8px 10px; border-radius:8px; background-color:rgba(255,255,255,0.6); color:#1f2937; border:1px solid transparent;">
                    <span style="display:inline-block; width:18px; color:#2563eb; font-weight:700; margin-right:8px;">&#9679;</span>
                    <span style="font-weight:600; color:#1f2937;">{{ $record['label'] }}</span>
                    <span style="float:right; color:rgba(37,99,235,0.55);">&#8599;</span>
                </a>
            @endforeach

            <span style="display:block; margin-top:12px; padding-top:10px; border-top:1px solid rgba(30,64,175,0.15); text-align:center;">
                <a href="{{ $url }}" target="_blank" rel="noopener" style="font-size:11px; line-height:1; letter-spacing:1px; text-transform:uppercase; color:#2563eb; text-decoration:none; font-weight:700;">
                    View all {{ $recordCount }} {{ $recordNoun }} &#8599;
                </a>
            </span>
        </span>
    @else
        <span style="display:block; color:#1f2937;">No records were updated.</span>
    @endif
@endsection
