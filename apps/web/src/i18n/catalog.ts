import type { en } from './en'

export type Shape<T> = {
    [K in keyof T]: T[K] extends (...args: infer A) => infer R
        ? (...args: A) => R
        : T[K] extends string
          ? string
          : Shape<T[K]>
}

export type Catalog = Shape<typeof en>
