/** The 7 category groups the trend engine researches (shared by server and client). */
export const CATEGORY_GROUPS = [
  { key: "tops", label: "Tops", research: "tops and shirts (crop tops, shirts, blouses, corsets, tanks, sweaters)" },
  { key: "bottoms", label: "Bottoms", research: "bottoms (jeans, trousers, skirts, shorts, palazzos)" },
  { key: "dresses", label: "Dresses & co-ords", research: "dresses, jumpsuits and co-ord sets" },
  { key: "ethnic", label: "Ethnic & festive", research: "Indian ethnic and festive wear (kurtas, kurta sets, sarees, lehengas, anarkalis, indo-western)" },
  { key: "footwear", label: "Footwear", research: "footwear (sneakers, heels, flats, sandals, boots, juttis, kolhapuris)" },
  { key: "jewellery", label: "Jewellery", research: "jewellery (earrings, necklaces, bangles, bracelets, rings)" },
  { key: "bags", label: "Bags & accessories", research: "bags and accessories (totes, slings, clutches, belts, sunglasses, scarves, hair accessories)" },
] as const;
export type GroupKey = (typeof CATEGORY_GROUPS)[number]["key"];
