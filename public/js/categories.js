// Icon SVG strings for category icons
const ICON_SVG = {
  books:        '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  electronics:  '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  clothing:     '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>',
  furniture:    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0z"/><line x1="6" y1="18" x2="6" y2="22"/><line x1="18" y1="18" x2="18" y2="22"/></svg>',
  'daily-needs':'<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  sports:       '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14.4 14.4 9.6 9.6"/><path d="M18.657 5.343A8 8 0 1 1 5.343 18.657 8 8 0 0 1 18.657 5.343z"/><path d="M5.343 5.343a8 8 0 0 1 11.314 11.314"/></svg>',
  gaming:       '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="12" r=".5" fill="currentColor"/><circle cx="17.5" cy="10" r=".5" fill="currentColor"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59l-.9 7.2A4 4 0 0 0 5.77 20h.59a4 4 0 0 0 3.02-1.38l.86-1a2 2 0 0 1 1.52-.7h.5a2 2 0 0 1 1.52.7l.86 1A4 4 0 0 0 17.64 20h.59a4 4 0 0 0 3.97-4.21l-.9-7.2A4 4 0 0 0 17.32 5z"/></svg>',
  other:        '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
};

// Category definitions
const CATEGORIES = [
  { icon: ICON_SVG.books,         name:'Books &amp; Textbooks',       slug:'books',        lucideIcon:'book-open'        },
  { icon: ICON_SVG.electronics,   name:'Electronics &amp; Computers',  slug:'electronics',  lucideIcon:'monitor'          },
  { icon: ICON_SVG.clothing,      name:'Clothing &amp; Fashion',       slug:'clothing',     lucideIcon:'shirt'            },
  { icon: ICON_SVG.furniture,     name:'Furniture &amp; Dorm',         slug:'furniture',    lucideIcon:'sofa'             },
  { icon: ICON_SVG['daily-needs'],name:'Daily Essentials',             slug:'daily-needs',  lucideIcon:'shopping-bag'     },
  { icon: ICON_SVG.sports,        name:'Sports &amp; Gym',             slug:'sports',       lucideIcon:'dumbbell'         },
  { icon: ICON_SVG.gaming,        name:'Hobbies &amp; Entertainment',  slug:'gaming',       lucideIcon:'gamepad2'         },
  { icon: ICON_SVG.other,         name:'Other',                        slug:'other',        lucideIcon:'folder-open'      },
];

// Category labels map for easy lookup
const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(c => [c.slug, c.name]));

// Export for Node.js (SSR)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CATEGORIES, CATEGORY_LABELS, ICON_SVG };
}
