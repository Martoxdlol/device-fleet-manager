export interface ListText {
    failed: string
    moreFailed: string
    loading: string
}

export interface TableText extends ListText {
    empty: string
    refreshFailed: string
    count: (count: number, loaded: string, total: string | undefined, more: boolean) => string
}
