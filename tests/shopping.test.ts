import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSearchQuery, shopLinks, toBuyCard, trendScore } from "../lib/shopping";
import type { Trend } from "../lib/types";

test("search query: lowercase, plain words, gender word added once", () => {
  assert.equal(buildSearchQuery("White Halter-Neck Lace Top"), "white halter neck lace top women");
  assert.equal(buildSearchQuery("Chunky gold hoops for women"), "chunky gold hoops for women");
  assert.equal(buildSearchQuery("Linen shirt", "men"), "linen shirt men");
  assert.equal(buildSearchQuery("Tote bag", "unisex"), "tote bag");
  assert.equal(buildSearchQuery("Black & white co-ord (cotton)"), "black and white co ord cotton women");
});

test("marketplace URL formats", () => {
  const l = shopLinks("white halter neck lace top");
  assert.equal(l.myntra, "https://www.myntra.com/white-halter-neck-lace-top");
  assert.equal(l.ajio, "https://www.ajio.com/search/?text=white%20halter%20neck%20lace%20top");
  assert.equal(l.nykaa, "https://www.nykaafashion.com/catalogsearch/result/?q=white%20halter%20neck%20lace%20top");
  assert.equal(l.amazon, "https://www.amazon.in/s?k=white%20halter%20neck%20lace%20top");
});

test("every link is https on the right marketplace domain", () => {
  const l = shopLinks(buildSearchQuery("Olive green cargo trousers"));
  for (const [k, host] of [["myntra", "www.myntra.com"], ["ajio", "www.ajio.com"], ["nykaa", "www.nykaafashion.com"], ["amazon", "www.amazon.in"]] as const) {
    const u = new URL(l[k]);
    assert.equal(u.protocol, "https:");
    assert.equal(u.host, host);
  }
});

const halter: Trend = {
  id: "t1", batch_id: "b", period: "daily", group_key: "tops", title: "Halter-neck tops", category: "topwear",
  match_attributes: { neckline: ["halter"] }, summary: null, why_now: null, how_to_style: null,
  heat: 5, price_band: "₹800–2,500", search_query: null, sources: [{ title: "Vogue India", url: "https://vogue.in/x" }], created_at: "",
};

test("trend badge attaches when attributes overlap", () => {
  assert.ok(trendScore("topwear", { neckline: "halter" }, "white halter top", halter) > 0);
  assert.equal(trendScore("bottomwear", { neckline: "halter" }, "halter", halter), 0);
  const card = toBuyCard(
    { title: "White halter-neck lace top", category: "topwear", attributes: { neckline: "halter" }, why: "", pairs_with_item_ids: [] },
    { trends: [halter], budgetBand: "budget" }
  );
  assert.equal(card.trend?.title, "Halter-neck tops");
  assert.equal(card.price_band, "₹800–2,500");
  assert.equal(card.links.myntra, "https://www.myntra.com/white-halter-neck-lace-top-women");
});

test("no trend → price band comes from the profile budget", () => {
  const card = toBuyCard({ title: "Brown loafers", category: "footwear", attributes: {}, why: "", pairs_with_item_ids: [] }, { trends: [halter], budgetBand: "budget" });
  assert.equal(card.trend, null);
  assert.equal(card.price_band, "Under ₹1,000");
});
