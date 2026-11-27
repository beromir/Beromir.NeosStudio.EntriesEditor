import { useMemo } from 'react'
import {
  useFormattedValues,
  type FormattedValueRequest,
  type NodeAddress,
} from '@medienreaktor/neos-studio'
import {
  humanize,
  resolveEntryLabel,
  templateKeys,
  type Entry,
  type EntriesOptions,
} from './entries'
import { configuredLabel, t } from './i18n'

export interface RowLabel {
  text: string
  missing: boolean
}

/**
 * Row labels with each value as its field's editor shows it (Studio's
 * formatValue). Until a value's label is resolved the stored value shows, so
 * a row never flickers to "Entry n"; Studio batches node lookups across rows
 * and only resolves a value again when it changes.
 */
export function useEntryLabels(
  entries: Entry[],
  options: EntriesOptions,
  nodeAddress: NodeAddress | undefined,
): (entry: Entry, index: number) => RowLabel {
  const { fields, labelTemplate, labelValues } = options

  const { requests, positions } = useMemo(() => {
    const requests: FormattedValueRequest[] = []
    const positions = new Map<string, number>()
    if (labelValues === 'raw') return { requests, positions }
    const labelled = templateKeys(labelTemplate, fields).flatMap((key) => {
      const field = fields.find((candidate) => candidate.name === key)
      return field ? [field] : []
    })
    for (const entry of entries) {
      for (const field of labelled) {
        positions.set(`${entry._id}\n${field.name}`, requests.length)
        requests.push({
          editorId: field.editor,
          value: entry[field.name],
          context: {
            subject: {
              name: field.name,
              type: field.type,
              label: configuredLabel(field.label, humanize(field.name)),
            },
            options: field.editorOptions,
            nodeAddress,
          },
        })
      }
    }
    return { requests, positions }
  }, [entries, fields, labelTemplate, labelValues, nodeAddress])

  const { labels } = useFormattedValues(requests)

  return (entry, index) => {
    const { label, missing } = resolveEntryLabel(entry, labelTemplate, fields, (key) => {
      const position = positions.get(`${entry._id}\n${key}`)
      const shown = position === undefined ? undefined : labels[position]
      // Studio labels a value that no longer resolves with its raw id or URI.
      return shown?.missing ? { label: t('valueMissing', 'Missing'), missing: true } : shown
    })
    return {
      text: label ?? t('entryFallback', 'Entry {0}', [index + 1]),
      missing,
    }
  }
}
