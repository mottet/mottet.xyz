'use strict';

// Shared house geography. Original project URLs remain directly accessible.
(() => {
  const rooms = [
    { id: 'studio', name: 'Drawing studio', href: '/drawing.html', floor: 'ground' },
    { id: 'salon', name: 'Games room', href: '/urBoard.html', floor: 'ground' },
    { id: 'garden', name: 'Maze garden', href: '/laby.html', floor: 'ground' },
    { id: 'music', name: 'Music room', href: '/musical-mining/', floor: 'first' },
    { id: 'laboratory', name: 'Laboratory', href: '/chemical-rakoon/', floor: 'first' }
  ];
  const path = window.location.pathname.replace(/index\.html$/, '').replace(/\/$/, '');
  const current = rooms.find(room => room.href.replace(/\/$/, '') === path);
  const isHome = document.body.classList.contains('house-home');
  if (!isHome && !current) return;
  const mapIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h18v18H3ZM3 13h8V3m0 10h10m-10 0v8"/></svg>';
  const hall = '/#' + (current?.floor === 'first' ? 'first-floor' : 'ground-floor');

  if (current) {
    document.body.classList.add('house-room', `house-room-${current.id}`);
    const nav = document.createElement('nav');
    nav.className = 'house-room-nav';
    nav.setAttribute('aria-label', 'Move through the house');
    nav.innerHTML = `<a class="house-return" href="${hall}"><span aria-hidden="true">←</span> ${current.floor === 'first' ? 'Landing' : 'Hall'}</a><span class="house-room-nav-divider" aria-hidden="true"></span><button type="button" data-house-map class="house-room-map" aria-label="Open floor plan. You are in the ${current.name.toLowerCase()}.">${mapIcon}<span>${current.name}</span><span aria-hidden="true">⌃</span></button>`;
    document.body.append(nav);
    document.getElementById('house-return-fallback')?.remove();
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'house-map';
  dialog.setAttribute('aria-labelledby', 'house-map-title');
  const roomLink = room => `<a class="house-map-room house-map-${room.id}${current?.id === room.id ? ' house-map-current' : ''}" href="${room.href}"${current?.id === room.id ? ' aria-current="page"' : ''}><strong>${room.name}</strong>${current?.id === room.id ? '<span class="house-map-current-dot" aria-hidden="true">●</span><small class="house-visually-hidden">You are here</small>' : ''}</a>`;
  dialog.innerHTML = `<div class="house-map-heading"><h2 id="house-map-title">Floor plan</h2><button class="house-map-close" type="button" aria-label="Close floor plan">×</button></div><div class="house-map-floors"><section aria-label="Ground floor"><h3>Ground</h3><div class="house-map-ground house-map-grid">${roomLink(rooms[2])}${roomLink(rooms[0])}<a class="house-map-hall" href="/#ground-floor"><span aria-hidden="true">↓</span><strong>Hall</strong></a>${roomLink(rooms[1])}</div></section><section aria-label="First floor"><h3>Upstairs</h3><div class="house-map-upper house-map-grid">${roomLink(rooms[3])}<a class="house-map-hall" href="/#first-floor"><span aria-hidden="true">↗</span><strong>Landing</strong></a>${roomLink(rooms[4])}</div></section></div>`;
  document.body.append(dialog);
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const links = [...dialog.querySelectorAll('button, a[href]')];
    const first = links[0], last = links[links.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  // The older p5 pages listen on window. House controls must not paint lines
  // or regenerate the maze, and key presses in the plan belong to navigation.
  const isolateControls = element => {
    for (const name of ['mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchmove', 'touchend', 'keydown', 'keyup']) {
      element.addEventListener(name, event => event.stopPropagation());
    }
  };
  isolateControls(dialog);
  const roomNav = document.querySelector('.house-room-nav');
  if (roomNav) isolateControls(roomNav);
  let opener;
  document.querySelectorAll('[data-house-map]').forEach(button => button.addEventListener('click', () => {
    opener = button;
    dialog.showModal();
    document.body.classList.add('house-map-open');
    dialog.querySelector('.house-map-close').focus();
  }));
  dialog.querySelector('.house-map-close').addEventListener('click', () => dialog.close());
  // Only the backdrop closes the map; clicks in the plan remain interactive.
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('house-map-open');
    opener?.focus();
  });
  // Hash links on the home page change floor without leaving a modal open.
  dialog.querySelectorAll('.house-map-hall').forEach(link => link.addEventListener('click', () => {
    if (isHome) dialog.close();
  }));
})();
