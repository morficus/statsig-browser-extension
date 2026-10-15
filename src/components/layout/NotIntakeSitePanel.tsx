import { Globe } from 'lucide-react'

import { INTAKE_SITE_MATCHES } from '@/src/lib/intake-site'

const INTAKE_SITE_PAGES = INTAKE_SITE_MATCHES.map((pattern) => pattern.replace(/^https:\/\//u, '').replace(/\*$/u, ''))

/**
 * Shown instead of the main tabs and the project gate when the inspected tab is not an Intake Site
 * page (REQ-SET-014). Nothing is read from such a tab.
 */
export function NotIntakeSitePanel() {
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-start gap-2">
          <Globe className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Not an Intake Site page</h2>
            <p className="text-xs text-muted-foreground">Intake Experiment Testing works only on these pages:</p>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {INTAKE_SITE_PAGES.map((page) => (
                <li key={page} className="font-mono text-xs">
                  {page}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Open one in this tab, then open the extension again.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
