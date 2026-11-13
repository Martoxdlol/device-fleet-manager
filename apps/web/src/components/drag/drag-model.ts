import { apple } from '../../lib/platform'

/** What a drop does with the payload. "none" refuses it. */
export type DropEffect = 'move' | 'copy' | 'none'

/**
 * A typed lane between drag sources and drop targets. Its `type` is registered on
 * `dataTransfer`, which is the only thing a target may read while a drag hovers it.
 */
export interface DragChannel<T> {
    readonly type: string
    /** Never set. It keeps two channels with different payloads from type-checking as one. */
    readonly payload?: T
}

export function dragChannel<T>(name: string): DragChannel<T> {
    return { type: `application/x-fleet-${name}` }
}

export interface DragStart {
    type: string
    payload: unknown
    /** Names the drag in its image and in the `text/plain` fallback. */
    label: string
}

/**
 * What a target accepts from this `dataTransfer` type, and from the computer's files. A target
 * with no `type` takes only the computer's files.
 */
export interface DropSpec {
    type?: string
    /** Names the target in the label at the pointer: "Move to Photos". */
    label?: string
    /** What a drop would do, given whether the copy key is held. */
    effect?: (copy: boolean) => DropEffect
    onDrop?: (effect: 'move' | 'copy') => void
    /**
     * Takes files dragged in from the computer, with the names of any folders among them, which
     * arrive as empty files. Without it the target refuses them.
     */
    files?: (files: File[], folders: string[]) => void
    /**
     * Takes folders dragged in from the computer, as the entries the browser lends only while
     * the drop event runs, with the files dropped beside them. A target that has it gets every
     * drop that carries a folder, and `files` the rest.
     */
    folders?: (files: File[], directories: FileSystemDirectoryEntry[]) => void
    /**
     * Whether it takes the dragged files, judged from their content types while they hover. A
     * browser that hides them while dragging lists none, and `files` decides at the drop.
     */
    takes?: (types: readonly string[]) => boolean
    /** The drop attaches what it carries, whether files or nodes, as the agent's chat does. */
    attach?: boolean
}

/** How long a drag rests on a target before it acts: a closed branch opens, a button navigates. */
export const SPRING_DELAY = 600

/** The drag model reissues `dragover` about every 350ms, so silence means the drag is gone. */
export const SILENCE = 600

type DragLike = { dataTransfer: DataTransfer; altKey: boolean; ctrlKey: boolean }

/** Ctrl copies on Windows and Linux, Option on Apple platforms, as their file managers do. */
export function copyKey(event: DragLike) {
    return apple ? event.altKey : event.ctrlKey
}

export const fromComputer = (transfer: DataTransfer) => transfer.types.includes('Files')

/** The content types of the files a drag carries, as far as the browser lists them. */
const draggedTypes = (transfer: DataTransfer) =>
    Array.from(transfer.items)
        .filter((item) => item.kind === 'file')
        .map((item) => item.type)

/**
 * The one rule every target follows: refuse silently. A refusal leaves `preventDefault`
 * uncalled, so the drag falls through to the target behind it. Files from the computer copy.
 * While they hover, `takes` may refuse them; at the drop, `files` decides.
 */
export function dropDecision(
    event: DragLike,
    spec: DropSpec | undefined,
    phase: 'over' | 'drop' = 'over',
) {
    if (!spec) return null
    if (fromComputer(event.dataTransfer)) {
        if (!spec.files) return null
        const types = phase === 'over' ? draggedTypes(event.dataTransfer) : []
        return !types.length || (spec.takes?.(types) ?? true) ? 'copy' : null
    }
    if (!spec.type || !event.dataTransfer.types.includes(spec.type)) return null
    const wanted = spec.effect?.(copyKey(event)) ?? 'none'
    return wanted === 'none' ? null : wanted
}

/** What the label at the pointer says a drop would do. */
export interface DropHint {
    action: 'move' | 'copy' | 'upload' | 'attach'
    label?: string
}

export function hintOf(event: DragLike, spec: DropSpec, effect: 'move' | 'copy'): DropHint {
    const action = spec.attach ? 'attach' : fromComputer(event.dataTransfer) ? 'upload' : effect
    return { action, label: spec.label }
}

/** Hands an accepted drop to the target: the computer's files, or the channel's payload. */
export function land(event: DragLike, spec: DropSpec, effect: 'move' | 'copy') {
    if (!fromComputer(event.dataTransfer)) return spec.onDrop?.(effect)
    const files: File[] = []
    const folders: string[] = []
    const directories: FileSystemDirectoryEntry[] = []
    for (const item of Array.from(event.dataTransfer.items)) {
        if (item.kind !== 'file') continue
        const entry = item.webkitGetAsEntry()
        const file = item.getAsFile()
        if (entry?.isDirectory) {
            folders.push(entry.name)
            directories.push(entry as FileSystemDirectoryEntry)
        } else if (file) files.push(file)
    }
    if (spec.folders && directories.length) spec.folders(files, directories)
    else spec.files?.(files, folders)
}

/** A file read from a folder, with its path relative to the folder dropped or chosen. */
export interface PathedFile {
    file: File
    path: string
}

const batchOf = (reader: FileSystemDirectoryReader) =>
    new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))

const fileOf = (entry: FileSystemFileEntry) =>
    new Promise<File | null>((resolve) => entry.file(resolve, () => resolve(null)))

async function leaves(entry: FileSystemEntry, into: FileSystemFileEntry[]) {
    if (entry.isFile) return void into.push(entry as FileSystemFileEntry)
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    for (let batch = await batchOf(reader); batch.length; batch = await batchOf(reader))
        for (const child of batch) await leaves(child, into)
}

/** Every file under the dropped folders, read asynchronously; one that cannot be read is left out. */
export async function readDirectories(
    directories: readonly FileSystemDirectoryEntry[],
): Promise<PathedFile[]> {
    const entries: FileSystemFileEntry[] = []
    for (const directory of directories) await leaves(directory, entries)
    const read = await Promise.all(entries.map((entry) => fileOf(entry)))
    return read.flatMap((file, index) =>
        file ? [{ file, path: entries[index]!.fullPath.replace(/^\//, '') }] : [],
    )
}
