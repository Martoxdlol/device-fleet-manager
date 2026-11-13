# Combobox

Generic single selection with search, virtualized options, and optional infinite cursor pagination. Uses the existing Base UI, TanStack Virtual, and TanStack Query dependencies.

`MultiCombobox` takes the same props with `value` as an array. A pick adds or removes an option and the popup stays open; the trigger shows the placeholder, so show the chosen options beside it. `getItemGroup` lists options under headings, those without one first.

## Server-backed options

Use inside the application's `QueryClientProvider`. Supply stable string IDs and a page adapter using the same `{ rows, nextCursor }` contract as the data table:

```tsx
import { useState } from 'react'
import { Combobox, useComboboxData } from '@/components/combobox'

type Person = { id: string; name: string }
const getItemId = (person: Person) => person.id
const getItemLabel = (person: Person) => person.name

function PersonPicker({ organizationId }: { organizationId: string }) {
    const [person, setPerson] = useState<Person | null>(null)
    const data = useComboboxData<Person>({
        queryKey: ['people', organizationId],
        getItemId,
        getItemLabel,
        fetchPage: async ({ search, cursor, signal }) => {
            const params = new URLSearchParams({ organizationId, search })
            if (cursor !== null) params.set('cursor', cursor)
            const response = await fetch(`/api/people?${params}`, { signal })
            if (!response.ok) throw new Error('Could not load people')
            return response.json() // { rows: Person[], nextCursor: string | null }
        },
    })

    return (
        <Combobox
            {...data}
            label="Person"
            placeholder="Choose a person"
            value={person}
            onValueChange={setPerson}
            getItemId={getItemId}
            getItemLabel={getItemLabel}
            name="personId"
            clearable
        />
    )
}
```

The endpoint above is an example; adapt `fetchPage` to your API.

### Search behavior

- Every keystroke immediately filters the currently loaded pages. Default matching ignores case, accents, and surrounding search whitespace. Supply `filter(item, search)` to search extra fields.
- Server search debounces by 250 ms (`debounceMs` is configurable). Each search has its own query key and starts with a null cursor.
- Previous items remain locally filtered until the new query resolves. Server results then replace them and preserve the server's ordering and fuzzy matches. The hook returns `filter: null` so the component does not filter those results again.
- Old responses cannot overwrite a newer query. Forward `signal` to your transport for cancellation. Failed searches retain local matches and offer Retry.
- Put organization, resource, and other filters in `queryKey`. Previous results are discarded when that scope changes. Selection is controlled separately; clear it in the consumer if changing scope should also clear the selection.
- Pagination pauses during a pending search. Scrolling near the bottom fetches the next cursor, deduplicates overlapping pages by ID, and stops at null. Empty intermediate pages continue loading. Failed pages offer explicit Retry; repeated cursors stop pagination with an error.

## Local options or custom data sources

```tsx
<Combobox
    items={people}
    label="Person"
    value={person}
    onValueChange={setPerson}
    getItemId={(item) => item.id}
    getItemLabel={(item) => item.name}
/>
```

Local search is built in. Control it with `search` and `onSearchChange` when needed. For an external data hook, pass `pagination` (`CursorPagination`, shared with DataTable), `loading`, `error`, and `onRetry`. Use `filter={null}` only when `items` already contains the exact results to display. Change `resetKey` when the data scope changes.

`renderItem` customizes option content; `getItemLabel` still supplies its accessible name and selected label. Options have a fixed height of 36 px; set `itemHeight` for multiline content. `className` styles the trigger wrapper and `popupClassName` styles the popup. The popup owns its bounded scroll area and follows the available viewport space.

The selected object can be outside the loaded pages without losing its label. `name` submits its stable ID in forms, and `required` preserves form validation. `clearable`, `disabled`, `id`, `placeholder`, `searchPlaceholder`, and `emptyState` cover common field behavior; `noun` names what the loading and error messages refer to. `renderValue` and `triggerClassName` adapt the trigger for navigation switchers. `actions` adds footer commands (for example, creating an organization); each closes the popup before running. Search clears on close; Base UI handles arrow navigation, Enter selection, Escape dismissal, and focus restoration.

Set `searchable={false}` for lists fixed in code (sorting, appearance, field types). This removes the search field while preserving custom rendering and keyboard selection. Data-driven lists retain search.

## Verification

```sh
cd apps/web
bunx playwright test combobox.pw.ts
```

The fixture is available at `/tests/fixtures/combobox.html` on the development server. Browser tests mock the remote API for deterministic pagination, pending searches, errors, and out-of-order responses.

Integration follows the [Base UI combobox documentation](https://base-ui.com/react/components/combobox) and [TanStack Query placeholder-data pattern](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data).
