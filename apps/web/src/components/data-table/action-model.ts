import type { DataTableActionContext, DataTableActionDef } from './types'

export function actionContext<T>(
    selectedIds: ReadonlySet<string>,
    rows: readonly T[],
    getRowId: (row: T) => string,
    via: DataTableActionContext<T>['via'],
): DataTableActionContext<T> {
    const selected = new Map<string, T>()
    for (const row of rows) {
        const id = getRowId(row)
        if (selectedIds.has(id)) selected.set(id, row)
    }
    return {
        selectedIds,
        selectionCount: selectedIds.size,
        selectedRows: [...selected.values()],
        allSelectedRowsLoaded: selected.size === selectedIds.size,
        via,
    }
}

export function resolveActions<T>(
    actions: readonly DataTableActionDef<T>[],
    context: DataTableActionContext<T>,
) {
    const place = context.via === 'toolbar' ? 'toolbar' : 'menu'
    return actions.flatMap((action) => {
        const placement = action.placement ?? 'both'
        if (context.via !== 'keys' && placement !== 'both' && placement !== place) return []
        const visible =
            typeof action.visible === 'function'
                ? action.visible(context)
                : (action.visible ?? true)
        if (!visible) return []
        const disabled =
            typeof action.disabled === 'function'
                ? action.disabled(context)
                : (action.disabled ?? false)
        const reason = typeof disabled === 'string' && disabled.length > 0 ? disabled : undefined
        return [
            {
                action,
                disabled: disabled !== false,
                reason,
                tooltip: reason ? `${action.label}: ${reason}` : (action.tooltip ?? action.label),
            },
        ]
    })
}
