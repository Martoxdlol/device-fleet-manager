# Data table

`DataTable` is a generic, virtualized list with a bounded scroll viewport. Import its components, hooks, and types from `src/components/data-table/index.ts`. It is application code, available to every feature; nothing in this directory depends on mock data, authentication, routes, or a domain model.

The database route uses it for collections, records and drafts, for example in [`CollectionRecords`](../../features/data/collection-records.tsx) with API queries and batch commits. The demo's `RecordsView` under `src/mock/data` supplies sample records and mock actions; copying `MockTableActions` would retain demonstration behavior.

The file explorer also uses the component through [`FilesView`](../../features/files/files-view.tsx). [`StorageUnitPage`](../../features/files/storage-unit-page.tsx) supplies the server-paged folder listing, pending uploads, permissions, sort and kind filters, preview/navigation handlers, and breadcrumbs. `FilesView` provides local search over loaded rows, the list/grid toggle, a tile renderer with thumbnails, and the New folder, Upload and Open actions, and remembers its view under the `files` storage key. A click opens the row and selects it: a folder is entered, a file is previewed. The page keeps the selection in sync with the URL through [`useUrlSelection`](../../hooks/use-url-selection.ts), so the selected file is the previewed file and a reload lands on both. Pending transfers have separate row IDs and cannot be selected or opened. Selection and scroll reset when switching storage unit or folder.

## Quick start in a feature

This example can live in `src/features/your-feature/items-table.tsx`. It supplies working local search and selection, while keeping record opening in the feature. All styling lives in Tailwind utilities on the components; there is no table CSS file or stylesheet import. The app's existing theme supplies the color tokens. No additional provider is needed for local rows; paged rows come from the feature's own query under the existing React Query provider.

```tsx
import { useState } from "react";
import {
  DataTable,
  DataTableActions,
  DataTableSearch,
  DataTableToolbar,
  DataTableViewOptions,
  useDataTable,
  type DataColumn,
  type DataTableActionDef,
} from "../../components/data-table";

type Item = { id: string; name: string };
const columns: DataColumn<Item>[] = [
  {
    key: "name",
    header: "Name",
    cell: (item) => item.name,
    width: 280,
    pinned: "left",
    hideable: false,
  },
];
const getRowId = (item: Item) => item.id;

export function ItemsTable({
  rows,
  actions = [],
  onOpen,
}: {
  rows: readonly Item[];
  actions?: readonly DataTableActionDef<Item>[];
  onOpen: (item: Item) => void;
}) {
  const [search, setSearch] = useState("");
  const table = useDataTable({ columns, getRowId });
  const visibleRows = rows.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <DataTable
        table={table}
        rows={visibleRows}
        label="Items"
        itemLabel="items"
        getRowLabel={(item) => item.name}
        onRowActivate={onOpen}
        resetKey={search}
        toolbar={
          <DataTableToolbar actions={<DataTableViewOptions table={table} />}>
            <DataTableSearch
              value={search}
              onChange={(value) => {
                setSearch(value);
                table.clearSelection();
              }}
            />
            <DataTableActions
              table={table}
              rows={visibleRows}
              actions={actions}
            />
          </DataTableToolbar>
        }
      />
    </div>
  );
}
```

The feature's parent must have a bounded height; `h-full` cannot establish that by itself. In an existing flex page, give the table region `flex: 1; min-height: 0; min-width: 0`. When switching resource scopes, key the consumer, for example `<ItemsTable key={collectionId} ... />`, to reset view and selection state.

## Styling

Use Tailwind utilities for spacing, typography, colors, interaction states, and container breakpoints. The named `@container/table` controls compact toolbars and pinned-column behavior independently of viewport width. `dt-*` classes are DOM hooks for measurements and browser checks; they have no stylesheet rules. Measured column widths and virtual row positions are runtime values, consumed by Tailwind arbitrary-value utilities. Toolbars, panel headers and the split detail header share the 49px `barClasses` constant from `core/layout/panel.tsx`, which is what keeps them aligned.

## Public entry point

| Export                                                                                              | Purpose                                                                                        |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `DataTable`, `useDataTable`                                                                         | Virtualized rendering and selection/view state                                                 |
| `DataTableToolbar`, `DataTableSearch`                                                               | Toolbar composition and controlled search                                                      |
| `DataTableActions`, `DataTableAction`, `DataTableSelection`                                         | Responsive action definitions or custom action composition                                     |
| `DataTableFilters`, `DataTableViewOptions`                                                          | Filter menu, and the View menu with layout or tile size, sort and visible properties           |
| `DataTableViewToggle`                                                                               | Standalone list/grid button for toolbars with room; the View menu carries it too               |
| `CursorPagination`                                                                                  | Cursor contract a feature's query fills in                                                     |
| `DataColumn`, `DataTableProps`, `DataTableOptions`, `DataTableController`                           | Typed columns, rendering props, state configuration, and controller                            |
| `DataTableActionDef`, `DataTableActionContext`, `DataTableFilterGroup`, `TableView`, `TileSize`, `TableSort` | Action/filter configuration and view state                                                |

`DataTable` requires only `table`, `rows`, and an accessible `label`. Optional `loading`, `error`, and `onRetry` handle initial loading and failure; `pagination` handles subsequent pages. Both states draw the same skeleton, the first page over the whole table and the next page as a few rows at the end. `emptyState`, `toolbar`, and `footer` accept feature-owned content. `getRowLabel` names rows for accessibility and `onRowActivate` opens a row. `rowGroup` sections the list: a heading row opens each run of rows whose group name differs from the previous row's, the empty string being the unlabelled first section; headings are not rows, so keyboard navigation and selection skip them (list view only). `totalCount` can represent a server total; omit it when unknown. `itemLabel` customizes the footer noun, `noun` the plural in its messages (such as "Couldn't load records", with the server's message below), and `className` customizes the root.

## Composition

```tsx
const table = useDataTable({
  columns: [
    {
      key: "name",
      header: "Name",
      cell: (record: Record) => record.name,
      width: 280,
      pinned: "left",
      hideable: false,
      sortable: true,
    },
  ],
  getRowId: (record) => record.id,
});

// The parent needs a bounded height (or flex: 1 with min-height: 0).
<DataTable
  table={table}
  rows={records}
  label="Records"
  getRowLabel={(record) => record.name}
  onRowActivate={openRecord}
  toolbar={
    <DataTableToolbar actions={<DataTableViewOptions table={table} />}>
      <DataTableSearch value={search} onChange={setSearch} />
      <DataTableActions table={table} rows={records} actions={recordActions} />
    </DataTableToolbar>
  }
  footer={breadcrumbs}
/>;
```

- `useDataTable`: selection, sorting, column widths/visibility, view (`list` or `grid`) and tile size (`sm`, `md`, `lg`). Selection and sorting support controlled `selection` / `onSelectionChange` and `sort` / `onSortChange` pairs; `setSort(key, direction)` sets an explicit order, which is what the Sort menu uses. Keep the same control mode for the lifetime of a table. Use `selectable: false` to omit checkboxes or a predicate to disable individual rows. Pass `storageKey` to remember view, tile size, column widths and visibility per browser under `fleet.view.table.<key>`; `resetView` restores the initial values.
- Grid view: pass `tile={(row, size) => ...}` to `DataTable` and `grid` to `DataTableViewOptions`. The tile renderer owns its media and label; the table draws the frame, the hover or selection checkbox, focus and the active state. One virtual item is one visual row of tiles, so virtualization, keys and measurement are unchanged. Arrow keys move in two dimensions, Home/End and Page keys work as in the list, and Shift ranges follow reading order. Widths are 96, 144 and 208px plus a two-line label; the viewport width decides how many tiles fit per row.
- `DataColumn<T>`: typed renderers, header labels/icons, width constraints, alignment, left/right pinning, visibility and sorting. Set `hideable: false` on the identifier. Render links, buttons, or menus in any cell; add `data-table-interactive` to custom interactive controls to prevent row opening.
- Toolbar, search, view controls, selection actions, footer, and empty state are independent slots. No domain actions or data fetching are embedded in the table.
- Use `DataTableAction` (`label`, `icon`, button props) for custom toolbar buttons. Put `DataTableFilters` beside `DataTableViewOptions` in the toolbar's `actions` slot: filter controls belong in the Filters menu, separately from record actions. Each filter group supplies `key`, `label`, `value`, `defaultValue`, `onValueChange`, and `options`. Active filters show a count; Clear filters restores their defaults. Toolbar buttons are square icons at every width, with the name in the tooltip and the aria-label; pass `showLabel` to render the text as well, which collapses back to an icon at 600px of container width or below. `DataTableActions` measures its available space at every width and keeps as many actions inline as fit, in definition order. Only the remaining actions move into the three-dot menu; the trigger disappears when all actions fit. When even the three-dot menu no longer fits beside the `actions` slot, the view tools there fold into that menu after the actions, `DataTableViewToggle` as an item and `DataTableFilters` and `DataTableViewOptions` as submenus, and come back once there is room. They fold only when every control in the slot is one of those three; a slot holding anything else stays where it is. The toolbar never scrolls horizontally. Search shrinks to fit. The selection count and Clear selection remain directly accessible. Menus render in portals outside the table.
- Selected means one thing. A click on a row selects it, replacing the selection, and calls `onRowActivate` to open it; the checkbox, a Cmd/Ctrl click and a Shift range select without opening. There is no second "active row" state: the brand bar and the tint both follow `aria-selected`, so a toolbar action always applies to what the user just clicked. Enter opens the focused row the way a click does, Space toggles it into the selection, and interactive cell controls never reach the row.
- Columns, sorting, filters and cell formatting remain consumer concerns. A sortable header **emits state**; it does not sort a partially loaded dataset. Local consumers can sort complete arrays; server consumers send sort/filter state to the query.

## Action visibility and disabled states

`DataTableActions` accepts typed action definitions and evaluates them against the current selection. It includes selection count/clear controls and renders global actions with zero selected rows. Put it directly inside `DataTableToolbar`; it does not need a `DataTableSelection` wrapper.

```tsx
const actions: DataTableActionDef<Record>[] = [
  {
    key: "import",
    label: "Import",
    icon: <Upload />,
    visible: ({ selectionCount }) => selectionCount === 0,
    onClick: openImport,
  },
  {
    key: "edit",
    label: "Edit",
    icon: <Pencil />,
    visible: ({ selectionCount }) => selectionCount === 1,
    disabled: ({ allSelectedRowsLoaded }) =>
      !allSelectedRowsLoaded && "Record not loaded",
    onClick: ({ selectedRows }) => editRecord(selectedRows[0]),
  },
  {
    key: "archive",
    label: "Archive",
    icon: <Archive />,
    disabled: ({ selectionCount }) =>
      selectionCount === 0 ? "Select at least one record" : false,
    onClick: ({ selectedIds }) => archiveRecords([...selectedIds]),
  },
];

<DataTableActions table={table} rows={records} actions={actions} />;
```

- `visible`: boolean or predicate; `false` hides the action. Defaults to `true`, independent of selection count.
- `disabled`: boolean, reason string, or predicate returning either. Defaults to `false`. A string disables the action and explains why in its tooltip. Disabled buttons remain focusable for discovering that explanation; mouse and keyboard activation cannot run their handler.
- Each predicate and handler receives `selectionCount`, `selectedIds`, `selectedRows`, and `allSelectedRowsLoaded`. Count uses selected IDs, including IDs outside the supplied rows. Row-based rules can require `allSelectedRowsLoaded` rather than evaluate an incomplete selection.
- Pass the same list to `DataTable` as `actions` and it builds the row menu and the menu of the empty space below the rows from it, and runs each action's `keys` while focus is in the list and not in a field. A right-click, Shift+F10 or the Menu key opens a row's menu at the pointer or the row, and a 500 ms long press on touch opens it as a bottom sheet (`components/action-menu.tsx`). A row's menu acts on the selection when the row is in it, and otherwise on that row alone, outlined while the menu is open and leaving the selection as it was; keys follow the focused row the same way. The empty space's menu gets no rows. `placement` keeps an action to the `toolbar` or the `menu`; `group` separates menu items; `context.via` says whether it runs from the toolbar, a menu or its keys; `menuTitle` names the rows in the sheet. Menus show `keys` on the right, written for the platform, and a disabled reason as a tooltip.
- `tooltip`, `showLabel`, and `variant: "destructive"` customize presentation. The overflow menu always displays labels, preserves visibility/disabled predicates, and shows disabled explanations beneath the label. Custom JSX actions are not automatically converted into menu items; use action definitions for this responsive behavior.
- Custom JSX remains supported. `DataTableSelection` retains its default behavior of hiding at zero selection; opt into `showWhenEmpty` when composing your own mixture of global and selection actions.

The mock actions demonstrate Import at zero selection, Refresh at any count, Archive visible but disabled at zero, Duplicate only at exactly one, and Delete only when something is selected. They only show demo notifications.

## Cursor data

Pass `pagination` from the feature's own infinite query. Adapt the server's shape at the boundary:

```tsx
const query = useInfiniteQuery({
  queryKey: ["records", workspaceId, collectionId, table.sort],
  initialPageParam: "",
  queryFn: ({ pageParam, signal }) =>
    listRecords({ cursor: pageParam || undefined, signal, sort: table.sort }),
  getNextPageParam: (page) => page.next_cursor ?? undefined,
});
const pages = query.data?.pages ?? [];

<DataTable
  table={table}
  rows={pages.flatMap((page) => page.items)}
  label="Records"
  loading={query.isPending}
  error={query.data ? undefined : query.error}
  onRetry={() => void query.refetch()}
  pagination={{
    nextCursor: pages.at(-1)?.next_cursor ?? null,
    fetchNextPage: () =>
      query.hasNextPage ? query.fetchNextPage() : Promise.resolve(),
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.data ? query.error : undefined,
  }}
  resetKey={JSON.stringify(table.sort)}
/>;
```

The pagination contract is `{ nextCursor: string | null, fetchNextPage: () => Promise<unknown>, isFetchingNextPage: boolean, error?: unknown }`. Only `null` ends pagination; an empty string is a valid opaque cursor. `nextCursor` must be the cursor the server returned for the last resolved page, never a placeholder standing in for a page that has not arrived. Queries that resolve with an error result instead of rejecting must expose it through `error`.

Loading starts near the end and continues until short pages fill the viewport. A synchronous request guard prevents duplicate requests, including Strict Mode effect replay. A failed page retains existing rows and selection and shows Retry, and nothing is retried until that button is pressed. Query-provider retry policy still applies. Query keys must include resource scope, search, filters, and sorting. Change `resetKey` with the query so scrolling/range anchors reset; key the consumer by collection/resource so its view state and selection cannot leak across resources.

Selection tracks **IDs**, including rows from previous pages. “Select all loaded rows” selects only loaded, eligible rows, never unseen server results. Consumers decide whether query changes clear selection; the CMS clears on search/filter changes. Prune selection if selected records are deleted. Supply immutable row arrays and stable unique IDs.

## Rendering and keyboard behavior

- TanStack Virtual renders the visible range plus eight overscan rows on either side; focused rows stay mounted. Fixed, clipped rows are 48px high, and grid rows are the tile height plus a 12px gap. Variable-height rows and inline expanded panels are intentionally outside this contract; open detail in the existing split view, which has a draggable divider remembered per `storageKey`.
- One CSS grid definition supplies both header and cell widths. All scrolling stays inside the table. Sticky headers and columns share that viewport. Direct DOM positioning avoids transformed ancestors and isolates the mutable virtualizer from React Compiler memoization.
- Pinned content columns become scrollable in containers narrower than 600px, including narrow split panes. Selection remains pinned so every field stays reachable on a phone.
- Focus a row: Up/Down, Home/End, Page Up/Down navigate; Enter opens; Space selects; Shift+Space or Shift-click selects a range. Shift+Up/Down extends selection. Ctrl/Cmd+A selects loaded eligible rows; Escape clears. Interactive cell controls retain their own keyboard behavior.
- Column separators support pointer/touch drag, Left/Right resize, Shift for larger steps, and double-click to reset. View offers column visibility.
- The grid exposes total row indexes even when most rows are unmounted. Unknown server totals use `aria-rowcount=-1`.

## Verification

Run `bun test tests`, `bun run test:table` and `bun run test:explorer` from `apps/web`. The last one builds the app and drives the real file explorer against a mocked API, which is where selection, navigation and preview are covered. Install test browsers once with `bunx playwright install chromium firefox webkit`.

The development-only fixture at `/tests/fixtures/data-table.html` exercises 10,000 records. Add `?mode=cursor`, `?mode=cursor&pageSize=3`, `?mode=cursor&fail=100`, or `?mode=cms` for paginated, underfilled, error and CMS cases. The default fixture renders a `tile` so the View menu offers the grid. It is not included in the production build. The file explorer is deliberately absent: a fixture would wire it differently from the app, so its behaviour is covered against the real page instead.
