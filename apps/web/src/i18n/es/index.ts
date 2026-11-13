import type { Catalog } from '../catalog'
import { common } from './common'
import { core } from './core'
import { app } from './app'
import { components } from './components'
import { pages } from './pages'
import { errors } from './errors'
import { auth } from './auth'
import { organizations } from './organizations'
import { fleets } from './fleets'
import { account } from './account'

export { es as calendar } from 'react-day-picker/locale'

export const es = {
    core,
    common,
    app,
    components,
    pages,
    errors,
    auth,
    organizations,
    fleets,
    account,
} satisfies Catalog
