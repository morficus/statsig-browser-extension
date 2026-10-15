import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppContent } from './App'

const { useAppLogicMock } = vi.hoisted(() => ({
  useAppLogicMock: vi.fn(),
}))

vi.mock('@/src/hooks/use-app-logic', () => ({
  useAppLogic: useAppLogicMock,
}))

vi.mock('@/src/hooks/use-theme', () => ({
  useTheme: vi.fn(),
}))

vi.mock('@/src/components/layout/Header', () => ({
  Header: () => <div data-testid="header" />,
}))

vi.mock('@/src/components/layout/GlobalModals', () => ({
  GlobalModals: () => <div data-testid="global-modals" />,
}))

vi.mock('@/src/components/layout/MainTabs', () => ({
  MainTabs: () => <div data-testid="main-tabs" />,
}))

vi.mock('@/src/components/layout/PageProjectGate', () => ({
  PageProjectGate: () => <div data-testid="page-project-gate" />,
}))

vi.mock('@/src/components/layout/NotIntakeSitePanel', () => ({
  NotIntakeSitePanel: () => <div data-testid="not-intake-site-panel" />,
}))

const BODY_IDS = ['main-tabs', 'page-project-gate', 'not-intake-site-panel']

const renderBody = (isIntakeSite: boolean | undefined, isPageMatched: boolean) => {
  useAppLogicMock.mockReturnValue({
    activeTab: 'feature_gates',
    handleLogout: vi.fn(),
    handleTabChange: vi.fn(),
    isIntakeSite,
    isPageMatched,
  })
  render(<AppContent />)
}

const shownBodies = () => BODY_IDS.filter((id) => screen.queryByTestId(id) !== null)

describe('popup body', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders no body while the Intake Site check is pending, but keeps the header and modals', () => {
    renderBody(undefined, true)

    expect(shownBodies()).toStrictEqual([])
    expect(screen.getByTestId('header')).toBeInTheDocument()
    expect(screen.getByTestId('global-modals')).toBeInTheDocument()
  })

  it('renders only the not-intake-site panel off-site, even when the page is matched', () => {
    renderBody(false, true)

    expect(shownBodies()).toStrictEqual(['not-intake-site-panel'])
  })

  it('renders the main tabs on an Intake Site page matched to a project', () => {
    renderBody(true, true)

    expect(shownBodies()).toStrictEqual(['main-tabs'])
  })

  it('renders the project gate on an Intake Site page without a matched project', () => {
    renderBody(true, false)

    expect(shownBodies()).toStrictEqual(['page-project-gate'])
  })
})
