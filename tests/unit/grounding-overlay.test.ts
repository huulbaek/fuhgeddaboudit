import { describe, it, expect, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import GroundingOverlay from '../../app/components/grounding/GroundingOverlay.vue'

describe('GroundingOverlay', () => {
  afterEach(() => {
    // Reset grounding state between tests
    const { isGrounding } = useGrounding()
    isGrounding.value = false
  })

  it('is hidden when grounding is not active', async () => {
    const { isGrounding } = useGrounding()
    isGrounding.value = false

    await mountSuspended(GroundingOverlay)
    // Teleported content goes to document.body
    const overlay = document.body.querySelector('.fixed.inset-0')
    expect(overlay).toBeNull()
  })

  it('shows fullscreen overlay when grounding is active', async () => {
    const { isGrounding } = useGrounding()
    isGrounding.value = true

    await mountSuspended(GroundingOverlay)
    const overlay = document.body.querySelector('.fixed.inset-0')
    expect(overlay).not.toBeNull()
    expect(overlay!.classList.contains('z-[100]')).toBe(true)
  })

  it('displays the reassurance heading', async () => {
    const { isGrounding } = useGrounding()
    isGrounding.value = true

    await mountSuspended(GroundingOverlay)
    const overlay = document.body.querySelector('.fixed.inset-0')
    expect(overlay).not.toBeNull()
    expect(overlay!.textContent).toContain('You are safe. You are here.')
  })

  it('displays all 5-4-3-2-1 grounding steps', async () => {
    const { isGrounding } = useGrounding()
    isGrounding.value = true

    await mountSuspended(GroundingOverlay)
    const overlay = document.body.querySelector('.fixed.inset-0')
    expect(overlay).not.toBeNull()
    const text = overlay!.textContent!

    expect(text).toContain('5')
    expect(text).toContain('things you can SEE')
    expect(text).toContain('4')
    expect(text).toContain('things you can TOUCH')
    expect(text).toContain('3')
    expect(text).toContain('things you can HEAR')
    expect(text).toContain('2')
    expect(text).toContain('things you can SMELL')
    expect(text).toContain('1')
    expect(text).toContain('thing you can TASTE')
  })

  it('has a dismiss button that calls dismiss()', async () => {
    const { isGrounding } = useGrounding()
    isGrounding.value = true

    await mountSuspended(GroundingOverlay)
    const overlay = document.body.querySelector('.fixed.inset-0')
    expect(overlay).not.toBeNull()

    const button = overlay!.querySelector('button')
    expect(button).not.toBeNull()
    expect(button!.textContent).toContain('I feel grounded')

    button!.click()
    expect(isGrounding.value).toBe(false)
  })
})
