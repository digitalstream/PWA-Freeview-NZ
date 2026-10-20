let menuReturnFocus = null

function toggleMenu (forceState) {
  const panel = document.getElementById('navPanel')
  const overlay = document.getElementById('overlay')
  if (!panel || !overlay) return
  const next = typeof forceState === 'boolean' ? forceState : !menuOpen
  if (next === menuOpen) return
  menuOpen = next
  panel.inert = !menuOpen
  panel.setAttribute('aria-hidden', String(!menuOpen))
  panel.classList.toggle('open', menuOpen)
  document.getElementById('navBackdrop').hidden = !menuOpen
  document.getElementById('menuButton').setAttribute('aria-expanded', String(menuOpen))
  document.getElementById('playerHost').inert = menuOpen
  if (menuOpen) {
    menuReturnFocus = document.activeElement
    clearTimeout(overlayTimeout)
    setupNavPanel()
    document.getElementById('closeNavButton').focus({ preventScroll: true })
    overlay.classList.add('hidden')
    overlay.inert = true
  } else {
    showOverlay()
    if (menuReturnFocus?.isConnected) menuReturnFocus.focus({ preventScroll: true })
    resetOverlayTimeout()
  }
}

function showAbout () {
  const dialog = document.getElementById('aboutDialog')
  if (!dialog.open) dialog.showModal()
}

function setupPanels () {
  document.getElementById('navBackdrop').addEventListener('click', () => toggleMenu(false))
  const dialog = document.getElementById('aboutDialog')
  document.getElementById('closeAboutButton').addEventListener('click', () => dialog.close())
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect()
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close()
  })
  document.addEventListener('keydown', event => {
    if (!menuOpen || dialog.open) return
    if (event.key === 'Escape') { event.preventDefault(); toggleMenu(false) }
    if (event.key !== 'Tab') return
    const focusable = [...document.getElementById('navPanel').querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')].filter(element => element.getClientRects().length)
    const first = focusable[0]; const last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  })
}
