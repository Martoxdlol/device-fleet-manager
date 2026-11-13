import type { en } from './en'

/** The shape of a catalog: the same entries as English, each function with its parameters. A
 * missing entry or a parameter of another type fails `tsc`. */
export type Shape<T> = {
    [K in keyof T]: T[K] extends (...args: infer A) => infer R
        ? (...args: A) => R
        : T[K] extends string
          ? string
          : Shape<T[K]>
}

export type Catalog = Shape<typeof en>
