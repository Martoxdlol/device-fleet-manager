// The entry apps import core from. Where core composes a shadcn control, as `Button`, `Badge` and `Dialog`, it exports
// core's, and the control it composes stays inside.
export { Calendar } from './ui/calendar'
export {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from './ui/dropdown-menu'
export { Icon, type IconName } from './ui/icon'
export { Input } from './ui/input'
export { Label } from './ui/label'
export { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
export {
    Badge,
    Button,
    ChromeTip,
    Dialog,
    EmptyState,
    Field,
    PageSpinner,
    Spinner,
    Surface,
} from './ui/primitives'
export { flatSurfaceClasses, planeClasses, surfaceClasses } from './ui/surface'
export { Switch } from './ui/switch'
export {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from './ui/table'
export { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
export { Textarea } from './ui/textarea'
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
export { cn } from './ui/utils'

export { AppFrame } from './scaffold/app-frame'
export { GlassIsland } from './scaffold/glass-island'
export { PageContent, Scaffold } from './scaffold/scaffold'
export { SpacingProvider } from './scaffold/spacing'
export { useSpacing, type Spacing } from './scaffold/spacing-context'
export { SplitDetailHeader, SplitView } from './scaffold/split-view'
export {
    MOBILE_WIDTH,
    STACKED_WIDTH,
    useMediaQuery,
    useMobile,
    useStackedPanels,
} from './scaffold/use-mobile'
export { VerticalSplit } from './scaffold/vertical-split'

export { AppShell, type ShellConfig } from './layout/app-shell'
export {
    BoundaryContext,
    useBoundary,
    type Boundary,
    type BoundaryName,
} from './boundary/boundary-context'
export { ActionsMenu, NavigationMenu } from './layout/mobile-menus'
export { BottomNavigation, RailNavigation, type NavItem } from './layout/navigation'
export { type PageAction } from './layout/page-actions'
export {
    PanelAction,
    PanelActions,
    PanelBody,
    PanelHeader,
    PanelTitle,
    barClasses,
} from './layout/panel'
export { PanelSheet } from './layout/panel-sheet'
export { usePanels } from './layout/panels-context'
export { Rail } from './layout/rail'
export { SidePanel } from './layout/side-panel'
export { SkipLink } from './layout/skip-link'
export { TopBar } from './layout/top-bar'

export { ResizeHandle, useResize, type ResizeOptions } from './resize'
export { KeyboardProvider } from './keyboard/keyboard-provider'
export {
    useEnterSends,
    useKeyboard,
    useShortcut,
    type KeyBinding,
} from './keyboard/keyboard-context'
export { ViewportProvider } from './viewport/viewport-provider'
export { useViewport } from './viewport/viewport-context'
export { StorageProvider } from './storage/storage-provider'
export { useStorage } from './storage/storage-context'
export { oneOf, useStoredState } from './storage/use-stored-state'
export { Link } from './link/link'
export { LinkContext, type LinkProps } from './link/link-context'
export {
    LocaleContext,
    coreEnglish,
    useLocale,
    type CoreMessages,
    type Locale,
} from './locale/locale-context'
export { ThemeProvider } from './theme/theme-provider'
export { useTheme, type Theme } from './theme/theme-context'
export { inkOn, parseHex } from './color/color'
