import { editors } from '@medienreaktor/neos-studio'
import { EntriesEditor } from './EntriesEditor'
import './plugin.css'

editors.register({
  id: 'Beromir.EntriesEditor/Editor',
  component: EntriesEditor,
})
