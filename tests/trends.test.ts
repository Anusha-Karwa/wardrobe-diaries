import { test } from "node:test";
import assert from "node:assert/strict";
import { augmentFromTitle, ownsTrend } from "../lib/trends";
import type { Item } from "../lib/types";

const item = (o: Partial<Item>): Item =>
  ({
    id: "x", upload_id: null, cutout_url: null, crop_url: "", cutout_method: null, bbox: null, category: "topwear", subcategory: "blouse",
    primary_color: "white", primary_color_hex: null, secondary_colors: [], pattern: "solid", sleeve_length: "sleeveless", sleeve_style: "regular",
    neckline: "round", fit: "regular", length: "regular", rise: "not_applicable", fabric: "cotton", wash: "not_applicable", embellishment: "none",
    style: "western", metal_tone: "not_applicable", occasion: [], season: [], formality: 2, aesthetic: ["minimal"], brand_visible: null, size: null,
    description: "", confidence: 1, user_edited: false, times_suggested: 0, created_at: "", ...o,
  }) as Item;

test("title words become match attributes, one attribute per word", () => {
  assert.deepEqual(augmentFromTitle("Barrel-Leg Horseshoe Jeans", "bottomwear", { subcategory: ["jeans"] }), { subcategory: ["jeans"], fit: ["barrel"] });
  assert.deepEqual(augmentFromTitle("Draped Halter & Scarf-Neck Blouses", "topwear", { subcategory: ["blouse"] }).neckline, ["halter"]);
  const lace = augmentFromTitle("Sheer Lace Peplum Tops", "topwear", {});
  assert.deepEqual(lace.fabric?.sort(), ["lace", "net"]);
  assert.equal(lace.pattern, undefined, "lace is not added twice");
  const juttis = augmentFromTitle("Velvet Embroidered Cushioned Juttis", "footwear", { subcategory: ["juttis"] });
  assert.deepEqual(juttis.fabric, ["velvet"]);
  assert.equal(Object.values(juttis).flat().filter((v) => v.startsWith("embroider")).length, 1);
  assert.equal(augmentFromTitle("Chunky Vintage Button Studs", "jewellery", { subcategory: ["earrings"] }).embellishment, undefined);
  assert.equal(augmentFromTitle("Gold buttons on wool coats", "outerwear", {}).metal_tone, undefined, "metal tone only for jewellery/bags");
});

test("owned needs a distinctive attribute, not just type/length/mood", () => {
  const dress = item({ category: "dress", subcategory: "midi_dress", length: "midi", pattern: "floral" });
  assert.equal(ownsTrend(dress, { category: "dress", match_attributes: { length: ["midi"] } }), false);
  const bag = item({ category: "bag", subcategory: "sling", aesthetic: ["minimal"] });
  assert.equal(ownsTrend(bag, { category: "bag", match_attributes: { subcategory: ["sling"], aesthetic: ["minimal"] } }), false);
});

test("owned when every defining attribute matches (with equivalent tags)", () => {
  const laceTop = item({ subcategory: "crop_top", pattern: "lace", fabric: "net" });
  assert.equal(ownsTrend(laceTop, { category: "topwear", match_attributes: { subcategory: ["blouse", "crop_top"], fabric: ["lace", "net"] } }), true);
  const halter = item({ subcategory: "crop_top", neckline: "halter" });
  assert.equal(ownsTrend(halter, { category: "topwear", match_attributes: { neckline: ["halter"] } }), true);
  const roundNeck = item({ subcategory: "crop_top", neckline: "round" });
  assert.equal(ownsTrend(roundNeck, { category: "topwear", match_attributes: { neckline: ["halter"] } }), false);
  const kurta = item({ subcategory: "kurta", primary_color: "maroon", pattern: "block_print" });
  assert.equal(ownsTrend(kurta, { category: "topwear", match_attributes: { primary_color: ["red"] } }), true, "maroon is a neighbour of red");
});
