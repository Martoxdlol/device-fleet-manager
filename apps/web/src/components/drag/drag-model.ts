import { apple } from '../../lib/platform'

export type DropEffect = 'move' | 'copy' | 'none'

export interface DragChannel<T> {
    readonly type: string
    readonly payload?: T
}

export function dragChannel<T>(name: string): DragChannel<T> {
    return { type: `application/x-fleet-${name}` }
}

export interface DragStart {
    type: string
    payload: unknown
    label: string
}

export interface DropSpec {
    type?: string
    label?: string
    effect?: (copy: boolean) => DropEffect
    onDrop?: (effect: 'move' | 'copy') => void
    files?: (files: File[], folders: string[]) => void
    folders?: (files: File[], directories: FileSystemDirectoryEntry[]) => void
    takes?: (types: readonly string[]) => boolean
    attach?: boolean
}

export const SPRING_DELAY = 600

export const SILENCE = 600

type DragLike = { dataTransfer: DataTransfer; altKey: boolean; ctrlKey: boolean }

export function copyKey(event: DragLike) {
    return apple ? event.altKey : event.ctrlKey
}

export const fromComputer = (transfer: DataTransfer) => transfer.types.includes('Files')

const draggedTypes = (transfer: DataTransfer) =>
    Array.from(transfer.items)
        .filter((item) => item.kind === 'file')
        .map((item) => item.type)

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

export interface DropHint {
    action: 'move' | 'copy' | 'upload' | 'attach'
    label?: string
}

export function hintOf(event: DragLike, spec: DropSpec, effect: 'move' | 'copy'): DropHint {
    const action = spec.attach ? 'attach' : fromComputer(event.dataTransfer) ? 'upload' : effect
    return { action, label: spec.label }
}

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
