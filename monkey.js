// Iridescent monkey — pure SVG, holographic-render style.
// Mounts into any element with [data-monkey], reading optional
// data-size, data-hue, data-mood (idle | happy | sad).
//
// Usage:
//   <div data-monkey data-size="360"></div>
//   <script src="monkey.js"></script>

(function () {
  let counter = 0;

  function buildMonkeySVG({ size = 240, hue = 0, mood = 'idle' } = {}) {
    const id = `m${++counter}`;
    const eyes =
      mood === 'sad'
        ? `<path d="M 88 70 l 6 6 M 94 70 l -6 6" stroke="#0a0a0a" stroke-width="2.5" stroke-linecap="round"/>
           <path d="M 106 70 l 6 6 M 112 70 l -6 6" stroke="#0a0a0a" stroke-width="2.5" stroke-linecap="round"/>`
        : mood === 'happy'
        ? `<path d="M 86 72 Q 91 66 96 72" stroke="#0a0a0a" stroke-width="2.5" stroke-linecap="round" fill="none"/>
           <path d="M 104 72 Q 109 66 114 72" stroke="#0a0a0a" stroke-width="2.5" stroke-linecap="round" fill="none"/>`
        : `<ellipse cx="91" cy="72" rx="3" ry="4" fill="#0a0a0a"/>
           <ellipse cx="109" cy="72" rx="3" ry="4" fill="#0a0a0a"/>
           <circle cx="92" cy="71" r="1" fill="#fff"/>
           <circle cx="110" cy="71" r="1" fill="#fff"/>`;

    return `
<div class="iri-monkey" style="width:${size}px;height:${size}px;position:relative;filter:hue-rotate(${hue}deg);transition:transform .22s cubic-bezier(.2,.8,.2,1);">
  <svg viewBox="0 0 200 200" width="${size}" height="${size}" style="overflow:visible;display:block;">
    <defs>
      <radialGradient id="g1-${id}" cx="35%" cy="30%" r="80%">
        <stop offset="0%" stop-color="#FFF6D6"/>
        <stop offset="22%" stop-color="#FFE9A8"/>
        <stop offset="42%" stop-color="#FF7A6B"/>
        <stop offset="62%" stop-color="#B4A3FF"/>
        <stop offset="82%" stop-color="#6CE6E0"/>
        <stop offset="100%" stop-color="#B9F5D0"/>
      </radialGradient>
      <linearGradient id="g2-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FF8FD0"/>
        <stop offset="40%" stop-color="#FFB86B"/>
        <stop offset="70%" stop-color="#6CE6E0"/>
        <stop offset="100%" stop-color="#B4A3FF"/>
      </linearGradient>
      <radialGradient id="g3-${id}" cx="60%" cy="40%" r="60%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
        <stop offset="40%" stop-color="#FFE9A8" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#FF7A6B" stop-opacity="0"/>
      </radialGradient>
      <filter id="f-${id}" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="0.4"/>
      </filter>
    </defs>

    <ellipse cx="100" cy="180" rx="60" ry="6" fill="#000" opacity=".5"/>
    <circle cx="100" cy="100" r="92" fill="url(#g1-${id})" opacity=".18"/>

    <path d="M 138 130 Q 175 130 175 100 Q 175 70 150 78"
      stroke="url(#g2-${id})" stroke-width="11" fill="none" stroke-linecap="round"/>

    <ellipse cx="100" cy="120" rx="48" ry="42" fill="url(#g1-${id})" filter="url(#f-${id})"/>
    <ellipse cx="100" cy="135" rx="28" ry="22" fill="url(#g3-${id})" opacity=".7"/>

    <path d="M 60 110 Q 40 100 35 80" stroke="url(#g2-${id})" stroke-width="14" fill="none" stroke-linecap="round"/>
    <path d="M 140 110 Q 160 100 168 78" stroke="url(#g2-${id})" stroke-width="14" fill="none" stroke-linecap="round"/>

    <path d="M 80 156 Q 78 175 88 182" stroke="url(#g2-${id})" stroke-width="13" fill="none" stroke-linecap="round"/>
    <path d="M 120 156 Q 122 175 112 182" stroke="url(#g2-${id})" stroke-width="13" fill="none" stroke-linecap="round"/>

    <circle cx="100" cy="68" r="36" fill="url(#g1-${id})" filter="url(#f-${id})"/>
    <ellipse cx="100" cy="76" rx="22" ry="20" fill="url(#g3-${id})" opacity=".85"/>

    <circle cx="65" cy="60" r="11" fill="url(#g2-${id})"/>
    <circle cx="65" cy="60" r="5" fill="url(#g3-${id})"/>
    <circle cx="135" cy="60" r="11" fill="url(#g2-${id})"/>
    <circle cx="135" cy="60" r="5" fill="url(#g3-${id})"/>

    ${eyes}

    <ellipse cx="100" cy="84" rx="3" ry="2" fill="#0a0a0a" opacity=".7"/>

    <path d="M 65 95 Q 100 80 140 100" stroke="#fff" stroke-width="1.5" fill="none" opacity=".35"/>
    <path d="M 70 130 Q 100 145 132 132" stroke="#FFE9A8" stroke-width="1" fill="none" opacity=".4"/>
    <path d="M 80 50 Q 100 42 120 50" stroke="#fff" stroke-width="1" fill="none" opacity=".45"/>
  </svg>
</div>`;
  }

  function mount() {
    document.querySelectorAll('[data-monkey]').forEach((el) => {
      if (el.dataset.monkeyMounted === '1') return;
      el.dataset.monkeyMounted = '1';
      const size = parseInt(el.dataset.size || '240', 10);
      const hue = parseFloat(el.dataset.hue || '0');
      const mood = el.dataset.mood || 'idle';
      el.innerHTML = buildMonkeySVG({ size, hue, mood });
    });
  }

  // Public API for dynamic updates (e.g., practice-mode tree).
  window.ClimbQuestMonkey = {
    mount,
    build: buildMonkeySVG,
    setMood(el, mood) {
      el.dataset.mood = mood;
      el.dataset.monkeyMounted = '0';
      mount();
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
