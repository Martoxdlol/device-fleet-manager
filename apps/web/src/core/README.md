# Core

`src/core` is the UI library the app is built on, written so another app can take it whole: the theme, the controls, the scaffold that places chrome and content, the application shell, resizing, keyboard shortcuts, the visual viewport, values remembered per browser, and links. Nothing here knows about organizations, workspaces, routes or the API.

## The boundary

Core imports only core and packages. The override in [`apps/web/.oxlintrc.json`](../../.oxlintrc.json) rejects any `../../` import and any `@/` import outside `@/core`, so a leak fails `bun run lint`. That rule assumes the layout it has today: one folder per module, files directly inside it, and siblings reaching each other through `../<module>/<file>`.

What is specific to an app comes in from outside, never the other way:

| Need                          | How core gets it                                                    |
| ----------------------------- | ------------------------------------------------------------------- |
| In-app links                  | `LinkContext` holds a function that renders the app's link          |
| Where remembered values live  | `StorageProvider` takes the key prefix                              |
| The mark at the top of the rail, the rail footer, the phone menu rows | `AppShell` slots: `railHeader`, `railFooter`, `mobileMenu` |
| Page title, back link, actions, panels | `AppShell` props                                           |
| The words core says, date and number formats, the calendar's language | `LocaleContext`, English and `en-US` without one |
| What shows in place of a slot or a dialog's body that crashed | `BoundaryContext` holds the app's error boundary, none without one |

## Mounting

The app mounts these once in [`main.tsx`](../main.tsx):

```tsx
const renderLink = (props: LinkProps) => <AppLink {...props} />

<StorageProvider prefix="fleet.view.">
    <LinkContext value={renderLink}>
        <ViewportProvider>
            <KeyboardProvider>
                <TooltipProvider delay={300}>{/* router */}</TooltipProvider>
            </KeyboardProvider>
        </ViewportProvider>
    </LinkContext>
</StorageProvider>
```

and each layout route wraps its pages in `ThemeProvider`, `SpacingProvider` and `AppFrame` ([`app-layout.tsx`](../app/app-layout.tsx)). `Link`, `useStoredState`, `useShortcut`, `useViewport` and `useTheme` throw without their provider.

## Theme

[`theme.css`](theme.css) is imported after Tailwind, as [`index.css`](../index.css) does. It holds shadcn's variables for light and dark, with `--primary` taking `--org-color` and `--primary-foreground` taking `--org-ink` when an app sets them, the `--viewport-*` and `--safe-area-bottom` defaults, the `app-sm`, `app-md`, `app-max-sm`, `app-max-md` and `app-stacked` container variants, and the base every page sits on: a document that scrolls, whose body becomes the size of the visual viewport and owns no scroll while an `AppFrame` is on the page (`html:has([data-app-area])`), the focus outline and reduced motion. The variants restate `MOBILE_WIDTH` and `STACKED_WIDTH` from [`scaffold/use-mobile.ts`](scaffold/use-mobile.ts), because CSS cannot import them. Change both together.

## Modules

- `ui`: the shadcn controls as the CLI writes them, plus [`primitives.tsx`](ui/primitives.tsx) (`Button`, `Surface`, `Dialog`, `Field`, `EmptyState`, `Spinner`, `ChromeTip` and the rest), the plane classes in [`surface.ts`](ui/surface.ts) and the icon names in [`icon.tsx`](ui/icon.tsx).
- `scaffold`: `AppFrame` splits the viewport into the app area and a column beside it, and every `app-*` variant and `useMobile`/`useStackedPanels` answers to the area's width. While it is mounted the document never scrolls, and it puts back WebKit's reveal of a focused field. `Scaffold` places the fixed and floating chrome around one bounded row of side panels and page content. `PageContent` decides who scrolls. `SplitView` and `VerticalSplit` split a pane with a divider the user drags.
- `layout`: `AppShell` and its parts (`Rail`, `TopBar`, `SidePanel`, `NavigationMenu`, `ActionsMenu`, `SkipLink`), the panel header family in [`panel.tsx`](layout/panel.tsx), `PanelSheet`, `usePanels` and `PageAction`.
- `resize`: `useResize` and `ResizeHandle`, the one way anything here is resized.
- `keyboard`: `useShortcut(binding, run)` binds a key while a component is mounted; `useEnterSends` tells a physical Enter from an on-screen one.
- `viewport`: `useViewport().keyboard` says whether an on-screen keyboard covers the page.
- `storage`: `useStoredState(key, fallback, parse)` is `useState` remembered per browser; `parse` rejects stale or foreign values. `useStorage()` reads and writes outside a state.
- `link`: `Link`, rendered by the app.
- `theme`: `ThemeProvider` and `useTheme`, light or dark, remembered per browser.
- `locale`: `LocaleContext` and `useLocale`, the words core says (`CoreMessages`, `coreEnglish` by default), the tag dates and numbers format with, and the calendar's locale.
- `boundary`: `BoundaryContext`, the app's error boundary, which `Rail` puts around its contents, `AppShell` around the main content and each panel, and `Dialog` around its body, each with its `BoundaryName`.
- `color`: `parseHex`, and `inkOn` for the ink that reads on a color.

## The shell

`AppShell` takes the page's title, navigation, panels and actions and lays them out for the screen it gets:

- From 768 pixels of app width, the rail sits at the left edge and the left panel beside the page. The user drags the left panel's inner edge between 200 and 480 pixels. Every page shares that width, kept under `shell.left`, and the panel gives up width while the page beside it would fall below 400. The panel button in the title island hides and shows it, and so does `leftShortcut`, the key the app gives. Whether it is hidden is one choice for every page, kept under `shell.left.hidden`, and a hidden panel stays mounted, so it keeps its state.
- From 1100 pixels the right panel sits beside the page too. Below that it opens as a sheet from the details button in the top bar.
- On a phone the left panel opens as a sheet from the top bar, the bottom bar carries the first `mobileNavLimit` destinations, and the rest, with `mobileMenu`, open from its last button. Only the highest priority action stays in the top bar; the others open from its menu.

## Resizing a pane

`useResize` handles the drag, the arrow keys, the double click that resets, and the separator's ARIA. The size is pixels, or a share of `container` when one is given. `ResizeHandle` draws the line and takes its size and place from the caller.

```tsx
const [width, setWidth] = useStoredState('notes.width', 320, parseWidth)
const resize = useResize({
    axis: 'x',
    pane: 'before',
    value: width,
    min: 240,
    max: 560,
    reset: 320,
    onCommit: setWidth,
})
return (
    <div className="relative" style={{ width: resize.value }}>
        {notes}
        <ResizeHandle
            {...resize.props}
            aria-label="Resize notes"
            className="absolute inset-y-0 left-full w-(--space-gap)"
        />
    </div>
)
```

`limits` narrows `min` and `max` to what the layout allows when a drag starts, such as the room the content beside the pane must keep.

## Adding shadcn controls

Run `bunx shadcn add <name>` in `apps/web`. [`components.json`](../../components.json) sends controls to `src/core/ui` and the `utils` alias to [`ui/utils.ts`](ui/utils.ts), so what the CLI writes imports `@/core/ui/...` and the `cn` package and passes the boundary. Run `bun run format` at the repository root afterwards; the CLI writes double quotes and semicolons. Compose on top of a control in `primitives.tsx` rather than editing the generated file.

## What goes where

- `src/core`: anything another app could use as is.
- `src/components`: The app's shared pieces built on core, such as the brand, the theme toggle, `PageLayout`, the data table and the combobox.
- `src/features`: product screens.
