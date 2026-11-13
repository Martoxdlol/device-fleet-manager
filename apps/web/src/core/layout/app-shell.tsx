import { useState, type ReactNode } from 'react'
import { useShortcut, type KeyBinding } from '../keyboard/keyboard-context'
import { Scaffold } from '../scaffold/scaffold'
import { useMobile, useStackedPanels } from '../scaffold/use-mobile'
import { useStoredState } from '../storage/use-stored-state'
import { useViewport } from '../viewport/viewport-context'
import { ActionsMenu, NavigationMenu } from './mobile-menus'
import { BottomNavigation, type NavItem } from './navigation'
import { rankActions, type PageAction } from './page-actions'
import { PanelSheet } from './panel-sheet'
import { PanelsContext } from './panels-context'
import { Rail } from './rail'
import { SidePanel } from './side-panel'
import { SkipLink } from './skip-link'
import { TopBar } from './top-bar'
import { useLocale } from '../locale/locale-context'
import { useBoundary } from '../boundary/boundary-context'

const LEFT_WIDTH = 248
const LEFT_MIN = 200
const LEFT_MAX = 480
const MAIN_MIN = 400
const parseLeftWidth = (raw: unknown) =>
    typeof raw === 'number' && raw >= LEFT_MIN && raw <= LEFT_MAX ? raw : undefined
const parseHidden = (raw: unknown) => (typeof raw === 'boolean' ? raw : undefined)

export interface ShellConfig {
    title: string
    titleContent?: ReactNode
    back?: { href: string; label: string }
    navigation: NavItem[]
    mobileNavLimit?: number
    leftPanel?: ReactNode
    leftShortcut?: { binding: KeyBinding; keys: string }
    rightPanel?: ReactNode
    actions?: PageAction[]
    toolbar?: ReactNode
    initialPanel?: 'left' | 'right'
    bottomNav?: ReactNode
    titleInContent?: boolean
    railHeader?: ReactNode
    railFooter?: ReactNode
    mobileMenu?: ReactNode
    commandBar?: ReactNode
}

export function AppShell({
    title,
    titleContent,
    back,
    navigation,
    mobileNavLimit = 3,
    leftPanel,
    leftShortcut,
    rightPanel,
    actions = [],
    toolbar,
    initialPanel,
    bottomNav,
    titleInContent = false,
    railHeader,
    railFooter,
    mobileMenu,
    commandBar,
    children,
}: ShellConfig & { children: ReactNode }) {
    const t = useLocale().messages
    const Boundary = useBoundary()
    const mobile = useMobile()
    const inspectorSheet = useStackedPanels()
    const { keyboard } = useViewport()
    const [leftWidth, setLeftWidth] = useStoredState('shell.left', LEFT_WIDTH, parseLeftWidth)
    const [leftHidden, setLeftHidden] = useStoredState('shell.left.hidden', false, parseHidden)
    const toggleLeft = () => setLeftHidden(!leftHidden)
    useShortcut(!mobile && leftPanel ? leftShortcut?.binding : undefined, toggleLeft)
    const [panel, setPanel] = useState<'left' | 'right' | 'more' | 'actions' | null>(
        initialPanel ?? null,
    )
    const [presentation, setPresentation] = useState({ mobile, inspectorSheet })
    if (presentation.mobile !== mobile || presentation.inspectorSheet !== inspectorSheet) {
        setPresentation({ mobile, inspectorSheet })
        setPanel(null)
    }
    const { shown, overflow } = rankActions(actions, mobile)
    const close = () => setPanel(null)
    const navigationButton = !leftPanel
        ? undefined
        : mobile
          ? { label: t.openNavigationPanel, onSelect: () => setPanel('left') }
          : {
                label: `${leftHidden ? t.showNavigationPanel : t.hideNavigationPanel}${leftShortcut ? ` (${leftShortcut.keys})` : ''}`,
                onSelect: toggleLeft,
            }
    const context = {
        openLeft: () => setPanel('left'),
        openRight: () => setPanel('right'),
        closePanels: close,
    }
    return (
        <PanelsContext value={context}>
            <SkipLink />
            <Scaffold
                fixed={{
                    left: !mobile && (
                        <Rail header={railHeader} navigation={navigation} footer={railFooter} />
                    ),
                }}
                floating={{
                    top: (
                        <TopBar
                            title={title}
                            titleContent={titleContent}
                            back={back}
                            titleInContent={titleInContent}
                            commandBar={commandBar}
                            toolbar={toolbar}
                            actions={shown}
                            navigationButton={navigationButton}
                            onMoreActions={overflow.length ? () => setPanel('actions') : undefined}
                            onOpenDetails={
                                inspectorSheet && rightPanel ? () => setPanel('right') : undefined
                            }
                        />
                    ),
                    left: !mobile && leftPanel && (
                        <SidePanel label={t.navigationPanel}>
                            <Boundary name="left">{leftPanel}</Boundary>
                        </SidePanel>
                    ),
                    right: !inspectorSheet && rightPanel && (
                        <SidePanel label={t.detailsPanel} className="w-68">
                            <Boundary name="right">{rightPanel}</Boundary>
                        </SidePanel>
                    ),
                    bottom:
                        mobile &&
                        !keyboard &&
                        (bottomNav === undefined ? (
                            <BottomNavigation
                                items={navigation.slice(0, mobileNavLimit)}
                                onMore={() => setPanel('more')}
                            />
                        ) : (
                            bottomNav
                        )),
                }}
                resizable={{
                    left: {
                        width: leftWidth,
                        min: LEFT_MIN,
                        max: LEFT_MAX,
                        reset: LEFT_WIDTH,
                        onResize: setLeftWidth,
                        label: t.resizeNavigationPanel,
                    },
                }}
                hidden={{ left: leftHidden }}
                mainMin={MAIN_MIN}
            >
                <Boundary name="main">{children}</Boundary>
            </Scaffold>
            <PanelSheet
                open={mobile && panel === 'left'}
                onClose={close}
                side="left"
                label={t.navigationPanel}
            >
                <Boundary name="left">{leftPanel}</Boundary>
            </PanelSheet>
            <PanelSheet
                open={inspectorSheet && panel === 'right'}
                onClose={close}
                side="right"
                label={t.detailsPanel}
            >
                <Boundary name="right">{rightPanel}</Boundary>
            </PanelSheet>
            <NavigationMenu
                open={mobile && panel === 'more'}
                onClose={close}
                items={navigation.slice(mobileNavLimit)}
            >
                {mobileMenu}
            </NavigationMenu>
            <ActionsMenu open={mobile && panel === 'actions'} onClose={close} actions={overflow} />
        </PanelsContext>
    )
}
