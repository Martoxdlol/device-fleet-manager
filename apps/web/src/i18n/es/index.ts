import type { Catalog } from '../catalog'
import { common } from './common'
import { core } from './core'
import { app } from './app'
import { components } from './components'
import { pages } from './pages'
import { errors } from './errors'

export { es as calendar } from 'react-day-picker/locale'

export const es = {
    core,
    common,
    app,
    components,
    pages,
    errors,
} satisfies Catalog
