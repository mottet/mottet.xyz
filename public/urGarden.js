'use strict';

// A room elevation: all the brasswork meets a stile, rail, or another branch.
// Small, reusable vector textures stay sharp without live noise filters.
(() => {
	let cachedMaterials;
	const walnutTexture = '/assets/ur/walnut-c5c3c1369b.webp';
	function seededRandom(seed) {
		return () => {
			seed = (seed * 1664525 + 1013904223) >>> 0;
			return seed / 4294967296;
		};
	}

	function materials(prefix) {
		if (cachedMaterials) return cachedMaterials.markup.replaceAll(cachedMaterials.prefix + '-', prefix + '-');
		const random = seededRandom(7103);
		const grain = [[], [], []];
		let grainX = -4;
		for (let i = 0; i < 42; i++) {
			const x = grainX += 4 + random() * 4.2;
			const bend = 2.5 + random() * 9;
			const phase = random() * Math.PI * 2;
			const points = [];
			for (let y = 0; y <= 512; y += 32) {
				// Periodic at the tile seam, with irregular annual-ring spacing.
				const offset = bend * Math.sin(y / 512 * Math.PI * 2 + phase)
					+ bend * .35 * Math.sin(y / 512 * Math.PI * 4 + phase)
					+ 14 * Math.exp(-(((y - 256) / 90) ** 2 + ((x - 110) / 36) ** 2)) * Math.sign(x - 110);
				points.push(`${(x + offset).toFixed(2)} ${y}`);
			}
			grain[i % 3].push('M' + points.join('L'));
		}
		const pores = [], glass = [];
		for (let i = 0; i < 120; i++) {
			const x = (random() * 256).toFixed(2), y = (random() * 512).toFixed(2);
			pores.push(`M${x} ${y}v${(1 + random() * 5).toFixed(2)}`);
			glass.push(`M${(random() * 96).toFixed(2)} ${(random() * 96).toFixed(2)}q2 -1 3 1`);
		}
		const markup = `<linearGradient id="${prefix}-walnut" x2="1" y2=".15">
		 <stop stop-color="#6a4028"/><stop offset=".24" stop-color="#8a5835"/><stop offset=".55" stop-color="#583321"/><stop offset=".8" stop-color="#75472c"/><stop offset="1" stop-color="#4e2f21"/>
		</linearGradient>
		<linearGradient id="${prefix}-brass" x2=".8" y2="1">
		 <stop stop-color="#ead39a"/><stop offset=".23" stop-color="#ba904c"/><stop offset=".48" stop-color="#8c612f"/><stop offset=".68" stop-color="#d5b574"/><stop offset="1" stop-color="#765027"/>
		</linearGradient>
		<pattern id="${prefix}-wood" width="256" height="512" patternUnits="userSpaceOnUse">
		 <rect width="256" height="512" fill="url(#${prefix}-walnut)"/>
		 <path d="${grain[0].join('')}" fill="none" stroke="#321c13" stroke-width="1.6" opacity=".18"/>
		 <path d="${grain[1].join('')}" fill="none" stroke="#efbd7e" stroke-width=".7" opacity=".09"/>
		 <path d="${grain[2].join('')}" fill="none" stroke="#321b10" stroke-width=".5" opacity=".3"/>
		 <path d="${pores.join('')}" stroke="#28170f" stroke-width=".6" opacity=".2"/>
		</pattern>
		<pattern id="${prefix}-glass-texture" width="96" height="96" patternUnits="userSpaceOnUse">
		 <path d="${glass.join('')}" fill="none" stroke="#fff4ca" stroke-width=".65" opacity=".17"/>
		</pattern>`;
		cachedMaterials = { prefix, markup };
		return markup;
	}

	function renderedMaterials(prefix) {
		return materials(prefix).replace(
			new RegExp(`<pattern id="${prefix}-wood"[\\s\\S]*?</pattern>`),
			`<pattern id="${prefix}-wood" width="256" height="512" patternUnits="userSpaceOnUse"><image href="${walnutTexture}" width="256" height="512"/></pattern>`
		);
	}

	function roomMarkup() {
		return `<defs>${renderedMaterials('room')}
		 <linearGradient id="room-glass" x2=".7" y2="1">
		  <stop stop-color="#d1b977"/><stop offset=".35" stop-color="#a28c50"/><stop offset=".7" stop-color="#6f7851"/><stop offset="1" stop-color="#3d5949"/>
		 </linearGradient>
		 <linearGradient id="room-amber" x2=".1" y2="1">
		  <stop stop-color="#e6cb87"/><stop offset=".5" stop-color="#bd9c58"/><stop offset="1" stop-color="#837046"/>
		 </linearGradient>
		 <radialGradient id="room-vignette" r=".75">
		  <stop offset=".25" stop-color="#22170f" stop-opacity="0"/><stop offset="1" stop-color="#1c130d" stop-opacity=".64"/>
		 </radialGradient>
		 <linearGradient id="room-wall" x2="0" y2="1">
		  <stop stop-color="#ab8856"/><stop offset=".5" stop-color="#a0865d"/><stop offset="1" stop-color="#60452e"/>
		 </linearGradient>
		 <path id="room-window-shape" d="M32 600V182C32 28 288 28 288 182V600Z"/>
		 <clipPath id="room-window-clip"><use href="#room-window-shape"/></clipPath>
		 <g id="room-window" data-material="glass">
		  <use href="#room-window-shape" fill="url(#room-glass)" stroke="#2a2118" stroke-width="22"/>
		  <g clip-path="url(#room-window-clip)">
		   <path d="M160 600C160 475 70 428 70 328C70 223 121 204 160 146C199 204 250 223 250 328C250 428 160 475 160 600Z" fill="url(#room-amber)"/>
		   <path d="M32 182C94 183 118 242 160 300C202 242 226 183 288 182V256C223 251 206 320 160 365C114 320 97 251 32 256Z" fill="#c5b77a" opacity=".55"/>
		   <path d="M32 448C95 419 120 475 160 516C200 475 225 419 288 448V600H32Z" fill="#3b5947" opacity=".48"/>
		   <path d="M51 176C51 108 104 76 157 76" stroke="#fff2bf" stroke-width="7" fill="none" opacity=".16"/>
		   <rect x="32" y="48" width="256" height="552" fill="url(#room-glass-texture)"/>
		  </g>
		  <g fill="none" stroke="#513e25" stroke-width="8" stroke-linejoin="round">
		   <path id="room-tracery" d="M160 600V300M160 600C160 475 70 428 70 328C70 223 121 204 160 146C199 204 250 223 250 328C250 428 160 475 160 600M32 182C94 183 118 242 160 300C202 242 226 183 288 182M32 256C97 251 114 320 160 365C206 320 223 251 288 256M32 448C95 419 120 475 160 516C200 475 225 419 288 448M160 146V66"/>
		  </g>
		  <use href="#room-tracery" fill="none" stroke="url(#room-brass)" stroke-width="4" stroke-linejoin="round"/>
		  <use href="#room-window-shape" fill="none" stroke="url(#room-brass)" stroke-width="7"/>
		  <path d="M32 600H288" stroke="#251b12" stroke-width="18"/>
		  <path d="M32 597H288" stroke="url(#room-brass)" stroke-width="5"/>
		 </g>
		 <pattern id="room-bays" width="320" height="1800" patternUnits="userSpaceOnUse">
		  <rect width="320" height="1800" fill="url(#room-wood)"/>
		  <rect x="14" y="24" width="292" height="606" rx="132" fill="#231b13"/>
		  <use href="#room-window"/>
		  <path d="M10 0V1800M310 0V1800" stroke="#2c1b12" stroke-width="9"/>
		  <path d="M15 0V1800M305 0V1800" stroke="#c59459" stroke-width="2" opacity=".6"/>
		 </pattern>
		 <pattern id="room-panels" width="240" height="1200" patternUnits="userSpaceOnUse">
		  <rect width="240" height="1200" fill="url(#room-wood)"/>
		  <rect x="24" y="30" width="192" height="520" rx="6" fill="#2d1c13"/>
		  <rect x="30" y="36" width="180" height="508" rx="4" fill="url(#room-wood)" stroke="#ac7c43" stroke-width="2"/>
		  <path d="M10 0V1200M230 0V1200" stroke="#291b13" stroke-width="8"/>
		 </pattern>

		</defs>
		<g data-room-layer="timber"><rect width="100%" height="100%" fill="url(#room-wall)"/>
		 <rect id="room-bay-field" y="30" width="100%" height="100%" fill="url(#room-bays)"/>
		</g>
		<g data-room-layer="joinery"><rect id="room-panel-field" width="100%" height="100%" fill="url(#room-panels)"/>
		 <rect id="room-dado-shadow" width="100%" height="24" fill="#251a11"/>
		 <rect id="room-dado" width="100%" height="11" fill="url(#room-wood)" stroke="#b58a50" stroke-width="2"/>
		 <rect y="8" width="100%" height="26" fill="url(#room-wood)" stroke="#ba925b" stroke-width="2"/>
		 <rect width="100%" height="8" fill="#302216"/>
		</g>
		<g data-room-layer="lighting"><rect width="100%" height="100%" fill="url(#room-vignette)"/>
		</g>`;
	}

	function paint(garden, width, height) {
		if (!garden.firstElementChild) {
			garden.innerHTML = roomMarkup();
			const tableMaterials = document.getElementById('table-materials');
			if (tableMaterials) tableMaterials.innerHTML = renderedMaterials('table');
		}
		const scale = width < 760 ? .72 : 1;
		const dado = Math.max(450, height * .76);
		garden.setAttribute('viewBox', `0 0 ${width} ${height}`);
		garden.querySelector('#room-bays').setAttribute('patternTransform', `translate(${width / 2 - 160 * scale} 30) scale(${scale})`);
		garden.querySelector('#room-panels').setAttribute('patternTransform', `translate(${width / 2 - 120 * scale} ${dado}) scale(${scale})`);
		for (const id of ['room-panel-field', 'room-dado-shadow', 'room-dado']) {
			garden.querySelector('#' + id).setAttribute('y', dado);
		}
		return { depth: 0, layers: 3, leaves: 0 };
	}
	window.UrGarden = { paint, materialDefinitions: materials };
})();
