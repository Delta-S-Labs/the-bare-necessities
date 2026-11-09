// Client demos: small shops whose owners manage their own collection.
//
// Each shop is a slug (the page lives at /demo/<slug>/ on the site) with the
// pieces it starts with. The owner signs in on /demo/<slug>/admin/ with the
// passcode in the env var DEMO_PASSCODE_<SLUG> (upper case, dashes as
// underscores), e.g. DEMO_PASSCODE_RAJANIS_BOUTIQUE. Without that variable the
// shop page still works; only the admin panel says it isn't set up.
//
// The starting pieces are SAMPLES: openly licensed photographs (credited on
// the shop page) with made-up names and prices, there to be replaced by the
// owner's own. Photo paths without a leading slash are relative to the shop
// page; uploaded photos are served by this API under /api/demo/<slug>/photos/.

export const CATEGORIES = ['Lehengas', 'Sarees', 'Salwar suits', 'Kurtis', 'Blouses', 'Dupattas'];
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free size'];

const p = (name) => [`img/${name}.webp`];

export const SHOPS = {
  'rajanis-boutique': {
    name: "Rajani's Boutique",
    pieces: [
      {
        id: 'green-lehenga', name: 'Bottle-green lehenga with a blush net dupatta', category: 'Lehengas',
        price: 9500, isNew: true, madeToMeasure: true, sizes: [],
        fabric: 'Velvet-finish skirt, raw-silk blouse, soft net dupatta',
        description: 'Zari and resham work on the skirt and blouse, with a scalloped border on the dupatta. Cut to your measurements; the blouse neckline and sleeve length are yours to choose.',
        photos: p('green-lehenga'),
      },
      {
        id: 'bridal-lehenga', name: 'Bridal lehenga in red and gold', category: 'Lehengas',
        price: 18500, isNew: false, madeToMeasure: true, sizes: [],
        fabric: 'Silk with zardozi and sequin work',
        description: 'A full bridal set: long jacket blouse, flared skirt and dupatta, worked all over in gold. Allow three to four weeks and two trial fittings.',
        photos: p('bridal-lehenga'),
      },
      {
        id: 'jacket-lehenga', name: 'Rust lehenga with a mustard jacket blouse', category: 'Lehengas',
        price: 7200, isNew: false, madeToMeasure: true, sizes: [],
        fabric: 'Printed cotton silk skirt, brocade jacket',
        description: 'A lighter lehenga for sangeet and puja days. The jacket blouse is lined and closes at the front; we can shorten it to a crop if you prefer.',
        photos: p('jacket-lehenga'),
      },
      {
        id: 'mirror-lehenga', name: 'Maroon flared lehenga with mirror work', category: 'Lehengas',
        price: 5800, isNew: true, madeToMeasure: true, sizes: ['S', 'M', 'L'],
        fabric: 'Cotton with mirror and thread embroidery',
        description: 'Twelve panels for a full twirl, with a printed border and scattered mirror work. Ready in three sizes, or stitched to your measure.',
        photos: p('mirror-lehenga'),
      },
      {
        id: 'baluchari-saree', name: 'Baluchari silk saree', category: 'Sarees',
        price: 6500, isNew: true, madeToMeasure: false, sizes: ['Free size'],
        fabric: 'Silk, woven pictorial pallu',
        description: 'Woven in Bishnupur, with figures from the old stories across the pallu. Comes with an unstitched blouse piece; we stitch the blouse to your measure.',
        photos: p('baluchari-saree'),
      },
      {
        id: 'banarasi-saree', name: 'Red Banarasi saree with a paisley border', category: 'Sarees',
        price: 5400, isNew: false, madeToMeasure: false, sizes: ['Free size'],
        fabric: 'Banarasi silk, zari buti',
        description: 'Small gold butis across the body and a deep paisley border. Fall and pico done before it leaves the shop.',
        photos: p('banarasi-saree'),
      },
      {
        id: 'tissue-saree', name: 'Gold tissue saree', category: 'Sarees',
        price: 4200, isNew: false, madeToMeasure: false, sizes: ['Free size'],
        fabric: 'Tissue silk with zari',
        description: 'Light and bright for evening functions. Pair it with one of our designer blouses, stitched to your measure.',
        photos: p('tissue-saree'),
      },
      {
        id: 'rust-silk-saree', name: 'Rust silk saree with a temple border', category: 'Sarees',
        price: 3800, isNew: false, madeToMeasure: false, sizes: ['Free size'],
        fabric: 'Silk with gold thread',
        description: 'A checked body and a temple border, easy to drape and easy to wear all day.',
        photos: p('rust-silk-saree'),
      },
      {
        id: 'printed-suit', name: 'Yellow printed cotton salwar suit', category: 'Salwar suits',
        price: 1850, isNew: true, madeToMeasure: true, sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        fabric: 'Cotton kameez and salwar, chiffon dupatta',
        description: 'Block-printed buta on a soft yellow ground, with a matching dupatta. Ready to wear in five sizes, or stitched to your measure in two days.',
        photos: p('printed-suit'),
      },
      {
        id: 'yellow-kurti', name: 'Yellow kurti with side slits', category: 'Kurtis',
        price: 950, isNew: false, madeToMeasure: true, sizes: ['S', 'M', 'L', 'XL'],
        fabric: 'Rayon with thread embroidery',
        description: 'A straight kurti with embroidery at the neck and hem. Good with leggings, palazzos or jeans.',
        photos: p('yellow-kurti'),
      },
      {
        id: 'peacock-blouse', name: 'Hand-embroidered peacock blouse', category: 'Blouses',
        price: 1600, isNew: false, madeToMeasure: true, sizes: [],
        fabric: 'Cotton silk with resham embroidery',
        description: 'Embroidered by hand, then cut and stitched to your measure. Choose the neckline, the back and the sleeve at your fitting.',
        photos: p('peacock-blouse'),
      },
      {
        id: 'bandhani-dupatta', name: 'Blue bandhani dupatta', category: 'Dupattas',
        price: 650, isNew: false, madeToMeasure: false, sizes: ['Free size'],
        fabric: 'Georgette, hand-tied bandhani',
        description: 'Tied and dyed by hand, two and a half metres long. Brightens a plain suit straight away.',
        photos: p('bandhani-dupatta'),
      },
    ],
  },
};

export function passcodeFor(shop) {
  return process.env[`DEMO_PASSCODE_${shop.toUpperCase().replace(/-/g, '_')}`] || '';
}
