<tr class="custom-permissions" id="module-custom-permission-{{ $modulesData->id }}">
    <td></td>
    <td colspan="4">
        <table class="table table-bordered rounded">
            @foreach ($modulesData->customPermissions as $permission)
                <tr>
                    <td>
                        <h6 class="heading-h6">@lang('permissions.'.$permission->name)</h6>
                    </td>
                    @php
                        if ($employee->customised_permissions === 1) {
                            $permissionType = $employee->permissionTypeId($permission->name);
                        } else {
                            $permissionType = $employee->permissionTypeId($permission->name) ?: $role->permissionType($permission->id);
                        }
                        $allowedPermissions = json_decode($permission->allowed_permissions);
                        if (($permissionType === 'added' || $permissionType === 1) && !isset($allowedPermissions->added) && isset($allowedPermissions->all)) {
                            $permissionType = 'all';
                        }
                    @endphp
                    <td>
                        <select class="role-permission-select border-0" data-permission-id="{{ $permission->id }}">
                            @if (!is_null($allowedPermissions))
                                @foreach ($allowedPermissions as $key => $item)
                                    <option @if ($permissionType == $key || $permissionType == $item) selected @endif @if ((!$permissionType || $permissionType === 'none') && $item == 5) selected @endif value="{{ $item }}">@lang('app.'.$key)</option>
                                @endforeach
                            @endif
                        </select>
                    </td>
                </tr>
            @endforeach

        </table>
    </td>
    <td></td>
</tr>
