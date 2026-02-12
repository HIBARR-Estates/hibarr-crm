@extends('mail.layouts.base')

@section('title', __('email.newTask.subject'))
@section('notifiableName', $notifiableName)

@section('actionText', __('app.viewTask'))
@section('actionUrl', $url)
@section('actionDescription', __('You can view the full details and take action on this task by clicking the button below:'))
@section('intro', __('email.newTask.text'))
@section('content')
    {!! $content !!}
@endsection
