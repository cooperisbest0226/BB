/* ==========================================================
   Icons
   SF Symbols 的字型授權不允許用在網頁，所以這裡自己畫一套
   同樣視覺重量（stroke 1.7 / round cap / 24 格線）的 SVG 圖示，
   離線可用、無外部請求、可繼承 currentColor。
   ========================================================== */

const P = {
  car:
    '<path d="M4.2 16.8v-3.3l1.9-4.7A2.3 2.3 0 0 1 8.3 7.3h7.4a2.3 2.3 0 0 1 2.2 1.5l1.9 4.7v3.3"/>' +
    '<path d="M4.2 13.5h15.6"/><path d="M9.8 16.9h4.4"/>' +
    '<circle cx="7.4" cy="16.9" r="2"/><circle cx="16.6" cy="16.9" r="2"/>',
  gauge:
    '<path d="M3.6 17.4a9 9 0 1 1 16.8 0"/><path d="M12 12.6 15.9 9"/>' +
    '<circle cx="12" cy="13.2" r="1.3"/>',
  drop:
    '<path d="M12 3.4c3.5 4.2 5.4 7 5.4 9.6a5.4 5.4 0 0 1-10.8 0c0-2.6 1.9-5.4 5.4-9.6Z"/>',
  shield:
    '<path d="M12 3.3 19 5.7v5.2c0 4.4-2.9 7.8-7 9.8-4.1-2-7-5.4-7-9.8V5.7l7-2.4Z"/>' +
    '<path d="M9.2 11.9l2.1 2.1 3.9-4.2"/>',
  seal:
    '<path d="M12 3.4l2.3 1.5 2.7-.1.8 2.6 2.2 1.6-1 2.5 1 2.5-2.2 1.6-.8 2.6-2.7-.1L12 19.6l-2.3-1.5-2.7.1-.8-2.6L4 14l1-2.5L4 9l2.2-1.6.8-2.6 2.7.1L12 3.4Z"/>' +
    '<path d="M9.3 11.9l2.1 2.1 3.8-4.2"/>',
  doc:
    '<path d="M6.6 3.6h7l4.8 4.8v12H6.6z"/><path d="M13.4 3.7v4.9h4.9"/>' +
    '<path d="M9.4 12.6h5.3M9.4 15.6h5.3M9.4 18.3h3.2"/>',
  battery:
    '<rect x="2.6" y="8.2" width="16.4" height="7.6" rx="2.4"/>' +
    '<path d="M21 11v2"/><path d="M4.8 10.4h4.9v3.2H4.8z"/>',
  tyre:
    '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="3.4"/>' +
    '<path d="M12 3.6v3M12 17.4v3M3.6 12h3M17.4 12h3"/>',
  calendar:
    '<rect x="3.4" y="5.2" width="17.2" height="15.4" rx="3"/>' +
    '<path d="M3.4 9.6h17.2M8.2 3.4v3.4M15.8 3.4v3.4"/>' +
    '<circle cx="8.4" cy="13.4" r=".9"/><circle cx="12" cy="13.4" r=".9"/><circle cx="15.6" cy="13.4" r=".9"/>',
  wrench:
    '<path d="M14.8 3.4a4.6 4.6 0 0 0-3 7.4l-7.3 7.3a1.9 1.9 0 0 0 2.7 2.7l7.3-7.3a4.6 4.6 0 0 0 5.5-6.6l-2.4 2.4-2.5-.6-.6-2.5 2.4-2.4a4.6 4.6 0 0 0-2.1-.4Z"/>',
  fuel:
    '<path d="M5.4 20.6V5.4a1.8 1.8 0 0 1 1.8-1.8h4.4a1.8 1.8 0 0 1 1.8 1.8v15.2"/>' +
    '<path d="M4.6 20.6h9.6M5.4 11.4h8"/>' +
    '<path d="M13.4 8.4h2.8a2 2 0 0 1 2 2v5.4a1.7 1.7 0 0 0 3.4 0V9.6l-2.2-3"/>',
  plus: '<path d="M12 4.8v14.4M4.8 12h14.4"/>',
  plusCircle: '<circle cx="12" cy="12" r="8.6"/><path d="M12 8.2v7.6M8.2 12h7.6"/>',
  chevronRight: '<path d="M9.4 5.6 16 12l-6.6 6.4"/>',
  chevronLeft: '<path d="M14.6 5.6 8 12l6.6 6.4"/>',
  chevronDown: '<path d="M5.6 9.2 12 15.6l6.4-6.4"/>',
  chevronUpDown: '<path d="M8 10.4 12 6.4l4 4M8 13.6l4 4 4-4"/>',
  xmark: '<path d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6"/>',
  check: '<path d="M4.8 12.8l4.6 4.6L19.2 7.4"/>',
  checkCircle: '<circle cx="12" cy="12" r="8.6"/><path d="M8.2 12.4l2.8 2.8 4.8-5.6"/>',
  pencil:
    '<path d="M16.4 3.9l3.7 3.7-11 11-4.6.9.9-4.6 11-11Z"/><path d="M14.2 6.1l3.7 3.7"/>',
  trash:
    '<path d="M4.6 6.8h14.8M9.4 6.8V4.6h5.2v2.2"/>' +
    '<path d="M6.4 6.8l.9 12.2a1.6 1.6 0 0 0 1.6 1.4h6.2a1.6 1.6 0 0 0 1.6-1.4l.9-12.2"/>' +
    '<path d="M10.4 10.4v6.4M13.6 10.4v6.4"/>',
  camera:
    '<path d="M3.4 8.8a2.4 2.4 0 0 1 2.4-2.4h1.9l1.3-2h5.9l1.3 2h1.9a2.4 2.4 0 0 1 2.4 2.4v9a2.4 2.4 0 0 1-2.4 2.4H5.8a2.4 2.4 0 0 1-2.4-2.4v-9Z"/>' +
    '<circle cx="12" cy="13.2" r="3.6"/>',
  photo:
    '<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="3"/>' +
    '<circle cx="8.6" cy="9.6" r="1.6"/><path d="M4.4 17.4l4.8-4.6 4 3.6 2.8-2.6 4.4 4"/>',
  bell:
    '<path d="M6.4 16.6V11a5.6 5.6 0 0 1 11.2 0v5.6l1.6 2.2H4.8l1.6-2.2Z"/>' +
    '<path d="M10 19.8a2.2 2.2 0 0 0 4 0"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2v5.2l3.4 2"/>',
  sparkles:
    '<path d="M9.4 3.6l1.5 3.9 3.9 1.5-3.9 1.5-1.5 3.9-1.5-3.9L4 8.9l3.9-1.4 1.5-3.9Z"/>' +
    '<path d="M17.2 13.6l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4Z"/>',
  sun: '<circle cx="12" cy="12" r="4.4"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7"/>',
  moon: '<path d="M20 14.6A8.6 8.6 0 0 1 9.4 4a8.6 8.6 0 1 0 10.6 10.6Z"/>',
  circleHalf: '<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4a8.6 8.6 0 0 1 0 17.2Z" fill="currentColor" stroke="none"/>',
  export: '<path d="M12 15.6V3.8M7.8 8 12 3.8 16.2 8"/><path d="M4.6 14.4v4a2 2 0 0 0 2 2h10.8a2 2 0 0 0 2-2v-4"/>',
  import: '<path d="M12 3.8v11.8M7.8 11.4 12 15.6l4.2-4.2"/><path d="M4.6 14.4v4a2 2 0 0 0 2 2h10.8a2 2 0 0 0 2-2v-4"/>',
  warning: '<path d="M12 4.2 21 19.4H3L12 4.2Z"/><path d="M12 9.4v4.8"/><circle cx="12" cy="16.8" r=".95" fill="currentColor" stroke="none"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.6"/><circle cx="12" cy="8" r=".95" fill="currentColor" stroke="none"/>',
  coin: '<circle cx="12" cy="12" r="8.6"/><path d="M14.8 9.2a3 3 0 1 0 0 5.6M9.6 10.6h4.2M9.6 13.4h4.2"/>',
  road: '<path d="M7.6 3.6 4.4 20.4M16.4 3.6l3.2 16.8M12 4.4v2.6M12 11v2.6M12 17.4V20"/>',
  refresh: '<path d="M20 6.4v4.8h-4.8"/><path d="M19.4 11.2a7.6 7.6 0 1 0-2.2 5.6"/>',
  gear:
    '<path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z"/>' +
    '<path d="M19.3 14.2a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.3a1.9 1.9 0 1 1-3.8 0V20a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H2.9a1.9 1.9 0 1 1 0-3.8h.3a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V2.9a1.9 1.9 0 1 1 3.8 0v.3a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.3a1.9 1.9 0 1 1 0 3.8H20a1.6 1.6 0 0 0-1.5 1Z"/>',
  chart: '<path d="M4 20h16"/><path d="M4 16.4l4.6-5.2 3.4 2.8 4-5 4 3.6"/>',
  list: '<path d="M8.4 6.8h11.2M8.4 12h11.2M8.4 17.2h11.2"/><circle cx="4.6" cy="6.8" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.6" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.6" cy="17.2" r="1.1" fill="currentColor" stroke="none"/>',
  key: '<circle cx="8.4" cy="8.4" r="4.4"/><path d="M11.6 11.6 20 20M16.4 16.4l2-2M14 14l2-2"/>',
  arrowUp: '<path d="M12 20V4.8M6 10.8 12 4.8l6 6"/>',
  ellipsis: '<circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
};

/** 回傳 SVG 字串。cls 可加額外 class（例如 icon--lg）。 */
export function icon(name, cls = '') {
  const body = P[name] || P.info;
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

export const ICON_NAMES = Object.keys(P);
