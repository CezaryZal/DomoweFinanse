import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'

afterEach(cleanup)

describe('SettingsPage', () => {
  it('saves the selected Gemini parser and confirms the result', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<SettingsPage initialVariant="rules" onSave={onSave} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Parser paragonów' }), { target: { value: 'gemini' } })
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz ustawienia' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('gemini'))
    expect(screen.getByRole('status')).toHaveTextContent('Zapisano parser: Model AI — Gemini 3.5')
    expect(screen.getByText('Model AI')).toBeVisible()
    expect(screen.getByText('Wybrany model będzie używany przez lokalny worker dla nowych paragonów.')).toBeVisible()
  })

  it('shows a saving error and allows another attempt', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Brak uprawnienia do zapisu ustawień.'))
    render(<SettingsPage initialVariant="rules" onSave={onSave} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Parser paragonów' }), { target: { value: 'gemini' } })
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz ustawienia' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Brak uprawnienia do zapisu ustawień.')
    expect(screen.getByRole('button', { name: 'Zapisz ustawienia' })).toBeEnabled()
  })
})
