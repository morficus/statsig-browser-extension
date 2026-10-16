import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import type { StatsigProject } from '@/src/lib/projects'

import { useContextStore } from '@/src/store/use-context-store'
import { useSettingsStore } from '@/src/store/use-settings-store'

import { usePageProject } from './use-page-project'

const project = (id: string): StatsigProject => ({
  apiKey: `console-${id}`,
  clientKeys: [`client-${id}`],
  gateHashes: [],
  id,
  label: `Project ${id}`,
  origins: [],
})

const OTHER_PAGE_KEYS = { gateHashes: [], hashedSdkKeys: [], sdkKeys: ['client-other'] }

describe('usePageProject', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      activeProjectId: 'a',
      apiKey: 'console-a',
      isApiKeyLoading: false,
      projects: [project('a')],
    })
    useContextStore.setState({
      detectedKeys: null,
      isIntakeSite: undefined,
      manualProjectId: undefined,
      projectMatch: null,
    })
  })

  it('matches the active project on an Intake Site tab without any SDK-key match', () => {
    useContextStore.setState({ detectedKeys: null, isIntakeSite: true, projectMatch: null })

    const { result } = renderHook(() => usePageProject())

    expect(result.current.status).toBe('matched')
    expect(result.current.reason).toBe('intake-site')
    expect(result.current.activeLabel).toBe('Project a')
  })

  it('matches the active project on an Intake Site tab whose SDK keys belong to no project', () => {
    useContextStore.setState({ detectedKeys: OTHER_PAGE_KEYS, isIntakeSite: true, projectMatch: null })

    const { result } = renderHook(() => usePageProject())

    expect(result.current.status).toBe('matched')
    expect(result.current.reason).toBe('intake-site')
  })

  it('leaves the same page as an unknown project when the tab is not known to be an Intake Site tab', () => {
    useContextStore.setState({ detectedKeys: OTHER_PAGE_KEYS, projectMatch: null })

    const { result } = renderHook(() => usePageProject())

    expect(result.current.status).toBe('unknown-project')
    expect(result.current.reason).toBeUndefined()
  })

  it('reports the Intake Site, not a manual pick, when both point at the active project', () => {
    useContextStore.setState({ isIntakeSite: true, manualProjectId: 'a' })

    const { result } = renderHook(() => usePageProject())

    expect(result.current.status).toBe('matched')
    expect(result.current.reason).toBe('intake-site')
  })

  describe('with a project picked by hand on an Intake Site tab', () => {
    beforeEach(() => {
      useSettingsStore.setState({
        activeProjectId: 'b',
        apiKey: 'console-b',
        projects: [project('a'), project('b')],
      })
      useContextStore.setState({
        isIntakeSite: true,
        manualProjectId: 'b',
        projectMatch: { projectId: 'a', reason: 'client-key' },
      })
    })

    it('says picked by hand when the page positively matched another configured project', () => {
      const { result } = renderHook(() => usePageProject())

      expect(result.current.status).toBe('matched')
      expect(result.current.reason).toBe('manual')
      expect(result.current.activeLabel).toBe('Project b')
    })

    it('reports the Intake Site when the detection found nothing', () => {
      useContextStore.setState({ projectMatch: null })

      const { result } = renderHook(() => usePageProject())

      expect(result.current.status).toBe('matched')
      expect(result.current.reason).toBe('intake-site')
    })

    it('reports the Intake Site before the automatic switch, when nothing was picked yet', () => {
      useContextStore.setState({ manualProjectId: undefined })

      const { result } = renderHook(() => usePageProject())

      expect(result.current.status).toBe('matched')
      expect(result.current.reason).toBe('intake-site')
    })

    it('reports the Intake Site when the matched project is not one of the projects', () => {
      useSettingsStore.setState({ projects: [project('b')] })

      const { result } = renderHook(() => usePageProject())

      expect(result.current.status).toBe('matched')
      expect(result.current.reason).toBe('intake-site')
    })
  })

  it('does not match on an Intake Site tab when no project is set up', () => {
    useSettingsStore.setState({ activeProjectId: '', apiKey: '', projects: [] })
    useContextStore.setState({ isIntakeSite: true })

    const { result } = renderHook(() => usePageProject())

    expect(result.current.hasProjects).toBeFalsy()
    expect(result.current.status).not.toBe('matched')
  })

  it('does not match on an Intake Site tab when the active project is not one of the projects', () => {
    useSettingsStore.setState({ activeProjectId: 'removed' })
    useContextStore.setState({ isIntakeSite: true })

    const { result } = renderHook(() => usePageProject())

    expect(result.current.hasProjects).toBeTruthy()
    expect(result.current.status).not.toBe('matched')
    expect(result.current.reason).not.toBe('intake-site')
  })

  it.each([false, undefined])("keeps today's detection when isIntakeSite is %s", (isIntakeSite) => {
    useContextStore.setState({ detectedKeys: null, isIntakeSite, projectMatch: null })

    const { result } = renderHook(() => usePageProject())

    expect(result.current.status).toBe('no-statsig')
    expect(result.current.reason).toBeUndefined()

    act(() => {
      useContextStore.setState({ detectedKeys: undefined, projectMatch: undefined })
    })

    expect(result.current.status).toBe('pending')
    expect(result.current.reason).toBeUndefined()
  })

  it('stays pending on an Intake Site tab while a project switch is saving', () => {
    useSettingsStore.setState({ isApiKeyLoading: true })
    useContextStore.setState({ isIntakeSite: true })

    const { result } = renderHook(() => usePageProject())

    expect(result.current.status).toBe('pending')
    expect(result.current.reason).toBeUndefined()
  })
})
