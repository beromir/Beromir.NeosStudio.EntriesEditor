import { useEffect, useState } from 'react'
import {
  translate,
  translatePlural,
  translationsLoaded,
  type TranslateArgs,
} from '@medienreaktor/neos-studio'
import { isTranslationId } from './entries'

const SOURCE = 'Beromir.NeosStudio.EntriesEditor:Main:'

export function t(id: string, fallback: string, args?: TranslateArgs): string {
  return translate(SOURCE + id, fallback, args)
}

export function tp(id: string, count: number, fallback: [string, string]): string {
  return translatePlural(SOURCE + id, count, fallback)
}

/** A label from editorOptions: a "Package:Source:id" translation id or plain text. */
export function configuredLabel(configured: string | undefined, fallback: string): string {
  if (!configured) return fallback
  return isTranslationId(configured) ? translate(configured, fallback) : configured
}

let loaded = false
void translationsLoaded().then(() => {
  loaded = true
})

/** Re-renders once the XLIFF bundle has loaded, for an editor mounted before that. */
export function useTranslationsReady(): void {
  const [, setReady] = useState(loaded)
  useEffect(() => {
    // No early return on `loaded`: it may have flipped between render and this
    // effect, and this editor still needs its re-render. A resolved promise is cheap.
    let active = true
    void translationsLoaded().then(() => active && setReady(true))
    return () => {
      active = false
    }
  }, [])
}
