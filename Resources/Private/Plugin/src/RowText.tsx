import { Icon } from '@medienreaktor/neos-studio'
import { t } from './i18n'
import type { RowLabel } from './useEntryLabels'

export function RowText({ label }: { label: RowLabel }) {
  return (
    <>
      {label.missing && (
        <Icon
          name="triangle-exclamation"
          size="s"
          className="bese-missing"
          label={t('entryMissing', 'Points at something that no longer exists')}
        />
      )}
      {label.text}
    </>
  )
}
