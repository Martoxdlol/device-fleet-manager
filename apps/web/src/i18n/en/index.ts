import { coreEnglish } from '../../core/locale/locale-context'
import { common } from './common'
import { app } from './app'
import { components } from './components'
import { pages } from './pages'
import { errors } from './errors'
import { auth } from './auth'
import { organizations } from './organizations'
import { fleets } from './fleets'
import { account } from './account'

export { enUS as calendar } from 'react-day-picker/locale'

export const en = {
    core: coreEnglish,
    common,
    app,
    components,
    pages,
    errors,
    auth,
    organizations,
    fleets,
    account,
}
