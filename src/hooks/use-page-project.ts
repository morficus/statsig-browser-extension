import type { DetectedStatsigKeys, ProjectDetection, ProjectMatch, StatsigProject } from '@/src/lib/projects'

import { findProject, getProjectDetection } from '@/src/lib/projects'
import { useContextStore } from '@/src/store/use-context-store'
import { useSettingsStore } from '@/src/store/use-settings-store'

interface DetectionInput {
  projects: StatsigProject[]
  activeProjectId: string
  isIntakeSite: boolean | undefined
  manualProjectId: string | undefined
  detectedKeys: DetectedStatsigKeys | null | undefined
  projectMatch: ProjectMatch | null | undefined
}

/**
 * Picks the detection once no project switch is pending: the Intake Site first (unless the Tester picked a
 * project by hand on a page that uses another one), then a manual pick, then the page read.
 */
const resolveDetection = ({
  activeProjectId,
  detectedKeys,
  isIntakeSite,
  manualProjectId,
  projectMatch,
  projects,
}: DetectionInput): ProjectDetection => {
  const isManualPick = manualProjectId === activeProjectId && Boolean(findProject(projects, manualProjectId))
  const matchedOtherProject = projectMatch
    ? projectMatch.projectId !== activeProjectId && Boolean(findProject(projects, projectMatch.projectId))
    : false
  // On the Intake Site the SDK-key match is skipped: every project counts as used on the page (Q5, WL-057).
  // One exception: the Tester picked the active project by hand, and the page is known to use another one.
  // Then "picked by hand" is the true label.
  if (isIntakeSite === true && findProject(projects, activeProjectId) && !(isManualPick && matchedOtherProject)) {
    return { reason: 'intake-site', status: 'matched' }
  }
  if (isManualPick) {
    return { reason: 'manual', status: 'matched' }
  }
  const validMatch =
    projectMatch && (projectMatch.projectId !== activeProjectId || !findProject(projects, projectMatch.projectId))
      ? null
      : projectMatch
  return getProjectDetection(projects, detectedKeys, validMatch)
}

/**
 * Whether the inspected page belongs to one of the configured projects, which is what decides if
 * any project data may be loaded at all. On an Intake Site tab the active project counts as matched
 * without the SDK-key match (Q5, WL-057). Everywhere else, a project picked by hand short-circuits
 * that question: the user asked for it, so it counts as matched until the popup closes. On the Intake
 * Site that label wins only when the page is known to use another configured project.
 *
 * @returns The detection status, the signal that resolved a match, the active project label and the
 *   client SDK key found on the page
 */
export const usePageProject = () => {
  const projects = useSettingsStore((state) => state.projects)
  const activeProjectId = useSettingsStore((state) => state.activeProjectId)
  const isApiKeyLoading = useSettingsStore((state) => state.isApiKeyLoading)
  const detectedKeys = useContextStore((state) => state.detectedKeys)
  const projectMatch = useContextStore((state) => state.projectMatch)
  const manualProjectId = useContextStore((state) => state.manualProjectId)
  const isIntakeSite = useContextStore((state) => state.isIntakeSite)

  const detection = resolveDetection({
    activeProjectId,
    detectedKeys,
    isIntakeSite,
    manualProjectId,
    projectMatch,
    projects,
  })
  const { reason, status } = isApiKeyLoading ? { reason: undefined, status: 'pending' as const } : detection

  return {
    activeLabel: findProject(projects, activeProjectId)?.label,
    detectedKey: detectedKeys?.sdkKeys[0],
    hasProjects: projects.length > 0,
    reason,
    status,
  }
}
