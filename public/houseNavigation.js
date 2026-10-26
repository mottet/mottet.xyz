'use strict';

// Shared house geography. Original project URLs remain directly accessible.
(() => {
  const rooms = [
    { id: 'studio', name: 'Drawing studio', note: 'a shared sheet of paper', href: '/drawing.html', floor: 'ground' },
    { id: 'salon', name: 'Games room', note: 'the Royal Game of Ur', href: '/urBoard.html', floor: 'ground' },
    { id: 'garden', name: 'Maze garden', note: 'a rose maze to walk', href: '/laby.html', floor: 'ground' },
    { id: 'music', name: 'Music room', note: 'Musical Mining', href: '/musical-mining/', floor: 'first' },
    { id: 'laboratory', name: 'Laboratory', note: 'Chemical Rakoon', href: '/chemical-rakoon/', floor: 'first' },
    { id: 'glyphs', name: 'Glyphs', note: 'a duel of drawn spells', href: '/glyphs.html', floor: 'first' }
  ];
  const byId = id => rooms.find(room => room.id === id);
  const path = window.location.pathname.replace(/index\.html$/, '').replace(/\/$/, '');
  const current = rooms.find(room => room.href.replace(/\/$/, '') === path);
  const isHome = document.body.classList.contains('house-home');
  if (!isHome && !current) return;
  const mapIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V11q9-11 18 0v10ZM3 15h18M12 15v6M9 3.5c2-1 4-1 6 0"/></svg>';
  let hall = '/#' + (current?.floor === 'first' ? 'first-floor' : 'ground-floor');
  if (current) {
    try {
      const arrival = JSON.parse(sessionStorage.getItem('mottet-apartment-return'));
      sessionStorage.removeItem('mottet-apartment-return');
      const apartmentHall = `/apartment.html#${current.floor}-floor`;
      if (arrival?.room === current.href && arrival.hall === apartmentHall) hall = apartmentHall;
    } catch { /* The standard house return works when storage is unavailable. */ }
  }

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
  const roomLink = room => `<a class="house-map-room house-map-${room.id}${current?.id === room.id ? ' house-map-current' : ''}" href="${room.href}"${current?.id === room.id ? ' aria-current="page"' : ''}><strong>${room.name}</strong><small>${room.note}</small>${current?.id === room.id ? '<span class="house-map-current-dot" aria-hidden="true">●</span><small class="house-visually-hidden">You are here</small>' : ''}</a>`;
  dialog.innerHTML = `<div class="house-map-heading"><div><p class="house-map-kicker">Plan of the house, two floors</p><h2 id="house-map-title">Floor plan</h2></div><button class="house-map-close" type="button" aria-label="Close floor plan">×</button></div><div class="house-map-floors"><section aria-label="Ground floor"><h3><span>Ground floor</span><small>three rooms around the hall</small></h3><div class="house-map-ground house-map-grid">${roomLink(byId('garden'))}${roomLink(byId('studio'))}<a class="house-map-hall" href="/#ground-floor"><span aria-hidden="true">↓</span><strong>Hall</strong></a>${roomLink(byId('salon'))}</div></section><section aria-label="First floor"><h3><span>Upstairs</span><small>three rooms off the landing</small></h3><div class="house-map-upper house-map-grid">${roomLink(byId('glyphs'))}${roomLink(byId('music'))}<a class="house-map-hall" href="/#first-floor"><span aria-hidden="true">↗</span><strong>Landing</strong></a>${roomLink(byId('laboratory'))}</div></section></div><svg class="house-map-flourish" viewBox="0 0 120 20" aria-hidden="true"><path d="M2 10C22 2 38 18 60 10C82 2 98 18 118 10"/><path d="M22 10C18 6 19 2 22 2M98 10C102 6 101 2 98 2" stroke-width=".9"/><path d="M60 10C53 6 54 0 60 0C66 0 67 6 60 10ZM60 10C53 14 54 20 60 20C66 20 67 14 60 10Z"/></svg>`;
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
