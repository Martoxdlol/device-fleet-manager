import { coreEnglish } from '../../core/locale/locale-context'
import { common } from './common'
import { app } from './app'
import { components } from './components'
import { pages } from './pages'
import { errors } from './errors'

export { enUS as calendar } from 'react-day-picker/locale'

/** The source catalog. Every other language has its shape (`Shape` in `../catalog`). */
export const en = {
    core: coreEnglish,
    common,
    app,
    components,
    pages,
    errors,
}
