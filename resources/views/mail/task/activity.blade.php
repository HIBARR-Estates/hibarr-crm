{{--
  Task assignee / lifecycle emails using the shared entity-activity layout.
--}}
@extends('mail.entity.activity')

@php
    $badgeLabel = $badgeLabel ?? 'Task Update';
    $actionDescription = __('Click the button below to view the task details.');
@endphp
