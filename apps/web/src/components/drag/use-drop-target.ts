import { useContext, useState, type DragEvent } from 'react'
import { useMessages } from '../../i18n/provider'
import { DragContext } from './drag-context'
import { dropDecision, hintOf, land, type DropSpec } from './drag-model'

export function useDropTarget(spec?: DropSpec) {
    const [over, setOver] = useState(false)
    const [files, setFiles] = useState(false)
    const session = useContext(DragContext)
    const t = useMessages()
    return {
        over,
        files: over && files,
        props: {
            onDragOver: (event: DragEvent) => {
                const effect = dropDecision(event, spec)
                if (!effect || !spec) return
                event.preventDefault()
                event.stopPropagation()
                event.dataTransfer.dropEffect = effect
                const hint = hintOf(event, spec, effect)
                session?.hint(t.components.drag[hint.action](hint.label))
                setOver(true)
                setFiles(event.dataTransfer.types.includes('Files'))
            },
            onDragLeave: (event: DragEvent) => {
                if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null))
                    setOver(false)
            },
            onDrop: (event: DragEvent) => {
                const effect = dropDecision(event, spec, 'drop')
                setOver(false)
                if (!effect || !spec) return
                event.preventDefault()
                event.stopPropagation()
                land(event, spec, effect)
            },
        },
    }
}
