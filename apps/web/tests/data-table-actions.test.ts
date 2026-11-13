import { describe, expect, test } from 'bun:test'
import { actionContext, resolveActions } from '../src/components/data-table/action-model'
import type { DataTableActionDef } from '../src/components/data-table/types'

type Record = { id: string; archived: boolean }
const rows: Record[] = [
    { id: 'a', archived: false },
    { id: 'b', archived: true },
]
const getRowId = (row: Record) => row.id
const noop = () => {}
const actions: DataTableActionDef<Record>[] = [
    {
        key: 'import',
        label: 'Import',
        icon: null,
        visible: ({ selectionCount }) => selectionCount === 0,
        onClick: noop,
    },
    { key: 'refresh', label: 'Refresh', icon: null, onClick: noop },
    {
        key: 'open',
        label: 'Open',
        icon: null,
        visible: ({ selectionCount }) => selectionCount === 1,
        onClick: noop,
    },
    {
        key: 'archive',
        label: 'Archive',
        icon: null,
        disabled: ({ selectionCount, selectedRows, allSelectedRowsLoaded }) =>
            !selectionCount
                ? 'Select a record'
                : !allSelectedRowsLoaded
                  ? 'Selected records are not loaded'
                  : selectedRows.some((row) => row.archived)
                    ? 'Already archived'
                    : false,
        onClick: noop,
    },
]

describe('selection-aware actions', () => {
    test('zero-selection actions render independently from disabled actions', () => {
        const result = resolveActions(actions, actionContext(new Set(), rows, getRowId, 'toolbar'))
        expect(result.map(({ action }) => action.key)).toEqual(['import', 'refresh', 'archive'])
        expect(result[0].disabled).toBe(false)
        expect(result[2]).toMatchObject({
            disabled: true,
            tooltip: 'Archive: Select a record',
        })
    })
    test('visibility and enabled state change independently with count and row values', () => {
        const single = resolveActions(
            actions,
            actionContext(new Set(['a']), rows, getRowId, 'toolbar'),
        )
        expect(single.map(({ action }) => action.key)).toEqual(['refresh', 'open', 'archive'])
        expect(single[2].disabled).toBe(false)
        const multiple = resolveActions(
            actions,
            actionContext(new Set(['a', 'b']), rows, getRowId, 'toolbar'),
        )
        expect(multiple.map(({ action }) => action.key)).toEqual(['refresh', 'archive'])
        expect(multiple[1]).toMatchObject({
            disabled: true,
            tooltip: 'Archive: Already archived',
        })
    })
    test('cursor selections outside loaded pages are not mistaken for a single selection', () => {
        const context = actionContext(
            new Set(['a', 'remote']),
            [...rows, rows[0]],
            getRowId,
            'toolbar',
        )
        expect(context.selectionCount).toBe(2)
        expect(context.selectedRows).toEqual([rows[0]])
        expect(context.allSelectedRowsLoaded).toBe(false)
        const result = resolveActions(actions, context)
        expect(result.map(({ action }) => action.key)).not.toContain('open')
        expect(result.at(-1)?.tooltip).toBe('Archive: Selected records are not loaded')
    })
    test('placement keeps an action to the toolbar or the menus, and keys reach both', () => {
        const placed: DataTableActionDef<Record>[] = [
            { key: 'tab', label: 'Open in new tab', icon: null, placement: 'menu', onClick: noop },
            { key: 'empty', label: 'Empty', icon: null, placement: 'toolbar', onClick: noop },
            { key: 'both', label: 'Both', icon: null, onClick: noop },
        ]
        const keysOf = (via: 'toolbar' | 'menu' | 'keys') =>
            resolveActions(placed, actionContext(new Set(['a']), rows, getRowId, via)).map(
                ({ action }) => action.key,
            )
        expect(keysOf('toolbar')).toEqual(['empty', 'both'])
        expect(keysOf('menu')).toEqual(['tab', 'both'])
        expect(keysOf('keys')).toEqual(['tab', 'empty', 'both'])
    })
})
