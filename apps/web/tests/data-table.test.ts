import { describe, expect, test } from 'bun:test'
import {
    columnLayout,
    columnWidth,
    selectRange,
    toggleLoaded,
} from '../src/components/data-table/model'
import { uniqueRows, validateNextCursor } from '../src/components/combobox/use-combobox-data'
import type { DataColumn } from '../src/components/data-table/types'

describe('table state and layout', () => {
    test('pinned offsets and header/body tracks stay aligned through resize and visibility changes', () => {
        const columns: DataColumn<string>[] = [
            { key: 'body', header: 'Body', width: 200, cell: (row) => row },
            {
                key: 'name',
                header: 'Name',
                width: 180,
                pinned: 'left',
                cell: (row) => row,
            },
            {
                key: 'action',
                header: 'Action',
                width: 100,
                pinned: 'right',
                cell: (row) => row,
            },
            {
                key: 'id',
                header: 'ID',
                width: 100,
                pinned: 'left',
                cell: (row) => row,
            },
        ]
        const layout = columnLayout(columns, { name: 250 }, true)
        expect(layout.template).toBe('42px 250px 100px minmax(200px, 1fr) 100px')
        expect(layout.minWidth).toBe(692)
        expect(layout.layouts.map((item) => item.style)).toEqual([
            { left: 42 },
            { left: 292 },
            {},
            { right: 0 },
        ])
        expect(
            columnLayout(
                columns.filter((c) => c.key !== 'name'),
                {},
                false,
            ).layouts[0].style,
        ).toEqual({ left: 0 })
        expect(columnWidth(columns[0], -100)).toBe(100)
        expect(columnWidth(columns[0], 9999)).toBe(800)
    })
    test('range selection uses current display order, supports reverse ranges and skips disabled IDs', () => {
        const ids = ['d', 'b', 'a', 'c']
        expect([...selectRange(new Set(), ids, 'a', 'd', true)]).toEqual(['d', 'b', 'a'])
        expect([...selectRange(new Set(ids), ids, 'a', 'd', true)]).toEqual(['c'])
        expect([...selectRange(new Set(), ids, 'missing', 'b', true)]).toEqual(['b'])
        expect([...selectRange(new Set(), ids, 'a', 'disabled', true)]).toEqual([])
    })
    test('select all loaded never loses selection from other pages', () => {
        expect([...toggleLoaded(new Set(['other', 'a']), ['a', 'b'])]).toEqual(['other', 'a', 'b'])
        expect([...toggleLoaded(new Set(['other', 'a', 'b']), ['a', 'b'])]).toEqual(['other'])
        expect([...toggleLoaded(new Set(['other']), [])]).toEqual(['other'])
    })
})

test('overlapping cursor pages replace rows without duplicates or order changes', () => {
    expect(
        uniqueRows(
            [
                {
                    rows: [
                        { id: 'a', n: 1 },
                        { id: 'b', n: 2 },
                    ],
                },
                {
                    rows: [
                        { id: 'a', n: 3 },
                        { id: 'c', n: 4 },
                    ],
                },
            ],
            (row) => row.id,
        ),
    ).toEqual([
        { id: 'a', n: 3 },
        { id: 'b', n: 2 },
        { id: 'c', n: 4 },
    ])
    expect(() => validateNextCursor('a', [null, 'a', 'b'])).toThrow('repeated')
})
