import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { NotIntakeSitePanel } from './NotIntakeSitePanel'

describe('not-intake-site panel', () => {
  it('names the Intake Site pages and what to do', () => {
    render(<NotIntakeSitePanel />)

    expect(screen.getByRole('heading', { name: 'Not an Intake Site page' })).toBeInTheDocument()
    expect(screen.getByText('Intake Experiment Testing works only on these pages:')).toBeInTheDocument()
    expect(screen.getByText('app.talkiatry.com/assessment')).toBeInTheDocument()
    expect(screen.getByText('app.staging.talkiatry.com/assessment')).toBeInTheDocument()
    expect(screen.getByText('Open one in this tab, then open the extension again.')).toBeInTheDocument()
  })
})
