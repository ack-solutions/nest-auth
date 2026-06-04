import { Control, FieldPath, FieldValues, useController } from 'react-hook-form';

import { RolePermissionChecklist } from '../../role/role-permission-checklist';

export interface RHFRolePermissionChecklistProps<T extends FieldValues> {
    name: FieldPath<T>;
    control: Control<T>;
    guard: string;
    disabled?: boolean;
    placeholder?: string;
}

export function RHFRolePermissionChecklist<T extends FieldValues>({
    name,
    control,
    guard,
    disabled,
    placeholder,
}: RHFRolePermissionChecklistProps<T>) {
    const { field } = useController({ name, control });

    return (
        <RolePermissionChecklist
            guard={guard}
            value={field.value ?? []}
            onChange={field.onChange}
            disabled={disabled}
            placeholder={placeholder}
        />
    );
}
