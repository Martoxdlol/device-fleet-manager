/** What a list says about its items, each a whole sentence in the app's language. A list never
 * drops a noun into a frame of its own, since Spanish agrees articles and words with it. */
export interface ListText {
    /** `Couldn't load rows` */
    failed: string
    /** `Couldn't load more rows` */
    moreFailed: string
    /** `Loading rows`, a spinner's label. */
    loading: string
}

export interface TableText extends ListText {
    /** `No rows` */
    empty: string
    /** `Couldn't refresh rows` */
    refreshFailed: string
    /**
     * The footer count, `12 rows`, `12 of 340 rows` or `12 rows loaded`. `count` picks the
     * plural; `loaded` and `total` come formatted; `more` while more pages wait and no total is
     * known.
     */
    count: (count: number, loaded: string, total: string | undefined, more: boolean) => string
}
