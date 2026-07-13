/*
 * Bada realistic catalog — ~1,01,500 products, real category-relevant Unsplash photos.
 * Ye PERMANENT catalog hai. Dobara chalane pe duplicate nahi banta (same slugs -> skip).
 *
 *   node scripts/catalog-100k.js
 *
 * KOI DUPLICATE NAAM NAHI:
 *  - High-volume categories (electronics/fashion/appliances) ke naam me unique
 *    model/style code hota hai — "Samsung Pro Smartphone M4231 (blue, 256GB)",
 *    "Levi's Slim Fit Jeans SM1042 (blue, L)" — bilkul Flipkart listings jaisa.
 *  - Low-volume categories (grocery/books/care) ka count unke unique combos ke
 *    andar rakha hai (mixed-radix enumeration) — har naam alag.
 *  - Distribution real store jaisa: electronics/fashion heavy, grocery/books light.
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const uns = (id, w, extra = "") =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop${extra}`;

// Subcategory slug -> relevant photo id (seed.ts wale hi — category-sahi images).
const SUBCAT_IMG = {
  mobiles: "1511707171634-5f897ff02aa9",
  laptops: "1496181133206-80ce9b88a853",
  headphones: "1505740420928-5e560c06d30e",
  cameras: "1516035069371-29a1b244cc32",
  "smart-watches": "1523275335684-37898b6baf30",
  "mens-clothing": "1521572163474-6864f9cf17ab",
  "womens-clothing": "1483985988355-763728e1935b",
  footwear: "1542291026-7eec264c27ff",
  watches: "1524805444758-089113d48a6d",
  "bags-backpacks": "1553062407-98eeb64c6a62",
  furniture: "1555041469-a586c61ea9bc",
  "kitchen-dining": "1556909212-d5b604d0c90d",
  "home-decor": "1513519245088-0e12902e5a38",
  bedding: "1540518614846-7eded433c457",
  staples: "1542838132-92c53300491e",
  "snacks-beverages": "1599490659213-e2b9527bd087",
  "personal-care": "1596462502278-27bfdc403348",
  televisions: "1593359677879-a4bb92f829d1",
  refrigerators: "1571175443880-49e1d25b2bc5",
  "washing-machines": "1626806787461-102c1bfaaea1",
  "kitchen-appliances": "1574269909862-7e1d70bb8078",
  fiction: "1544716278-ca5e3f4abd8c",
  "non-fiction": "1512820790803-83ca734da794",
  "childrens-books": "1503676260728-1c00da094a0b",
  "toys-games": "1566576912321-d58ddd7a6088",
  "kids-clothing": "1519689680058-324335c77eba",
  "baby-care": "1515488042361-ee00e0ddd4e4",
  "school-supplies": "1607453998774-d533f65dac99",
};
const FALLBACK_IMG = "1441986300917-64674bd600d8";
const productImages = (subcatSlug, v) => {
  const id = SUBCAT_IMG[subcatSlug] ?? FALLBACK_IMG;
  const crops = ["", "&flip=h", "&sat=-60", "&bri=10", "&con=15"];
  const a = crops[v % crops.length];
  const b = crops[(v + 1) % crops.length];
  return [uns(id, 700, a), uns(id, 700, b), uns(id, 700, "&blur=0" + a)];
};

// In categories me color ka koi matlab nahi — naam/filter me nahi aata.
const NO_COLOR = new Set([
  "staples", "snacks-beverages", "fiction", "non-fiction",
  "childrens-books", "personal-care", "baby-care",
]);

// count: kitne products; tag: naam me unique model code ("M"/"SM") — high-volume ke liye.
// Untagged categories ka count unke unique name-combos se KAM hai (duplicate impossible).
const RECIPES = {
  mobiles: { count: 10000, tag: "M", brands: ["samsung", "apple", "oneplus", "xiaomi", "realme"], adj: ["5G", "Pro", "Max", "Neo", "Prime", "Ultra", "Lite"], types: ["Smartphone"], variants: ["64GB", "128GB", "256GB", "512GB"], price: [7999, 149999] },
  laptops: { count: 10000, tag: "M", brands: ["hp", "dell", "lenovo", "asus", "acer", "apple"], adj: ["Slim", "Gaming", "Business", "Student", "Creator", "Ultra"], types: ["Laptop", "Notebook"], variants: ["i3/8GB", "i5/16GB", "i7/16GB", "Ryzen5/8GB", "M-series"], price: [24999, 219999] },
  headphones: { count: 10000, tag: "M", brands: ["sony", "boat", "jbl", "apple"], adj: ["Bass", "ANC", "Wireless", "Sport", "Studio", "Gaming"], types: ["Earbuds", "Headphones", "Neckband", "Speaker"], variants: ["Black", "White", "Blue", "Red"], price: [499, 34999] },
  cameras: { count: 7000, tag: "M", brands: ["canon", "nikon", "sony"], adj: ["DSLR", "Mirrorless", "Vlogging", "Action", "Compact"], types: ["Camera", "Camera Kit"], variants: ["18-55mm", "50mm", "Body Only", "Dual Lens"], price: [21999, 189999] },
  "smart-watches": { count: 7000, tag: "M", brands: ["apple", "samsung", "boat", "fastrack", "titan"], adj: ["Fit", "Active", "Sport", "Classic", "Pro"], types: ["Smartwatch", "Fitness Band"], variants: ["Black", "Silver", "Rose Gold", "Blue"], price: [999, 45999] },
  "mens-clothing": { count: 10000, tag: "SM", brands: ["levi-s", "nike", "adidas", "puma"], adj: ["Slim Fit", "Regular Fit", "Classic", "Stretch", "Casual", "Printed"], types: ["Jeans", "T-Shirt", "Shirt", "Hoodie", "Track Pants", "Jacket", "Shorts"], variants: ["S", "M", "L", "XL", "XXL"], price: [399, 4999] },
  "womens-clothing": { count: 10000, tag: "SM", brands: ["levi-s", "nike", "adidas", "puma"], adj: ["High-Rise", "Slim", "Printed", "Solid", "Casual", "Regular"], types: ["Jeans", "Kurti", "Top", "Leggings", "Dress", "T-Shirt", "Saree"], variants: ["XS", "S", "M", "L", "XL"], price: [349, 5999] },
  footwear: { count: 10000, tag: "SM", brands: ["nike", "adidas", "puma"], adj: ["Running", "Walking", "Training", "Casual", "Court", "Trail"], types: ["Shoes", "Sneakers", "Sandals", "Slides"], variants: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10"], price: [799, 17999] },
  watches: { count: 4000, tag: "SM", brands: ["titan", "fastrack"], adj: ["Analog", "Chronograph", "Classic", "Slim", "Sport"], types: ["Watch"], variants: ["Leather Strap", "Steel Strap", "Silicone"], price: [995, 24999] },
  "bags-backpacks": { count: 4000, tag: "SM", brands: ["american-tourister", "wildcraft"], adj: ["Casual", "Travel", "Laptop", "Trekking", "College"], types: ["Backpack", "Duffel Bag", "Trolley", "Rucksack"], variants: ["25L", "32L", "45L", "60L"], price: [699, 12999] },
  televisions: { count: 4000, tag: "M", brands: ["sony", "samsung", "lg", "xiaomi"], adj: ["4K UHD", "Full HD", "OLED", "QLED", "Smart"], types: ["Smart TV", "LED TV"], variants: ["32\"", "43\"", "50\"", "55\"", "65\""], price: [11999, 199999] },
  refrigerators: { count: 3000, tag: "M", brands: ["lg", "samsung", "whirlpool", "bosch"], adj: ["Frost-Free", "Direct Cool", "Convertible", "Inverter"], types: ["Refrigerator"], variants: ["190L", "253L", "260L", "308L", "500L"], price: [11999, 89999] },
  "washing-machines": { count: 3000, tag: "M", brands: ["lg", "samsung", "bosch", "whirlpool"], adj: ["Front Load", "Top Load", "Semi-Automatic", "Inverter"], types: ["Washing Machine"], variants: ["6kg", "6.5kg", "7kg", "8kg", "9kg"], price: [8999, 64999] },
  "kitchen-appliances": { count: 4000, tag: "M", brands: ["bajaj", "philips", "prestige"], adj: ["Digital", "Auto", "Turbo", "Compact"], types: ["Mixer Grinder", "Air Fryer", "Electric Kettle", "OTG Oven", "Induction Cooktop", "Toaster", "Rice Cooker"], variants: ["500W", "750W", "1000W", "1.5L", "4L"], price: [599, 24999] },
  furniture: { count: 4000, tag: "M", brands: [], adj: ["Sheesham Wood", "Engineered Wood", "Ergonomic", "Foldable", "Modern", "Solid Wood"], types: ["Sofa", "Study Table", "Office Chair", "Bed", "Bookshelf", "Dining Set", "Wardrobe", "TV Unit"], variants: ["Walnut", "Oak", "Teak", "Wenge"], price: [1999, 79999] },
  "kitchen-dining": { count: 250, brands: ["prestige", "tata", "bajaj"], adj: ["Non-Stick", "Stainless Steel", "Hard Anodised", "Induction Base"], types: ["Cookware Set", "Kadhai", "Tawa", "Dinner Set", "Jar Set", "Casserole"], variants: ["2pc", "3pc", "5pc", "24pc"], price: [299, 9999] },
  "home-decor": { count: 100, brands: [], adj: ["Handcrafted", "Vintage", "Modern", "Boho", "Minimal"], types: ["Wall Art", "Vase", "String Lights", "Rug", "Wall Clock", "Photo Frame", "Planter"], variants: ["Small", "Medium", "Large"], price: [199, 7999] },
  bedding: { count: 100, brands: [], adj: ["Cotton", "Microfiber", "Reversible", "Printed", "Solid"], types: ["Bedsheet Set", "Comforter", "Pillow Pack", "Blanket", "Mattress Protector"], variants: ["Single", "Double", "Queen", "King"], price: [399, 6999] },
  staples: { count: 90, brands: ["tata"], adj: ["Organic", "Premium", "Daily"], types: ["Toor Dal", "Chana Dal", "Atta", "Basmati Rice", "Sunflower Oil", "Mustard Oil", "Sugar", "Salt"], variants: ["1kg", "2kg", "5kg", "10kg"], price: [49, 1499] },
  "snacks-beverages": { count: 250, brands: ["nestle", "amul", "tata"], adj: ["Classic", "Spicy", "Family Pack", "Party Pack"], types: ["Noodles", "Chocolate", "Biscuits", "Chips", "Tea", "Coffee", "Juice", "Namkeen"], variants: ["Pack of 4", "Pack of 6", "Pack of 12"], price: [20, 999] },
  "personal-care": { count: 100, brands: ["philips"], adj: ["Advanced", "Herbal", "Gentle", "Pro"], types: ["Trimmer", "Hair Dryer", "Body Wash", "Shampoo", "Face Wash", "Moisturizer", "Sunscreen"], variants: ["100ml", "200ml", "400ml", "650ml"], price: [99, 4999] },
  fiction: { count: 80, brands: ["penguin", "harpercollins"], adj: ["Bestselling", "Award-Winning", "Classic", "New"], types: ["Novel", "Thriller", "Romance", "Fantasy", "Mystery"], variants: ["Paperback", "Hardcover"], price: [99, 999] },
  "non-fiction": { count: 60, brands: ["penguin", "harpercollins"], adj: ["Bestselling", "Inspiring", "Practical"], types: ["Self-Help Book", "Biography", "History Book", "Business Book", "Psychology Book"], variants: ["Paperback", "Hardcover"], price: [149, 1299] },
  "childrens-books": { count: 45, brands: ["penguin", "harpercollins"], adj: ["Illustrated", "Interactive", "Early Learning"], types: ["Story Book", "Picture Book", "Activity Book", "Comics Set"], variants: ["Paperback", "Board Book"], price: [99, 1499] },
  "toys-games": { count: 100, brands: [], adj: ["Educational", "Remote Control", "Battery Operated", "DIY", "Classic"], types: ["Building Blocks", "Car Toy", "Doll House", "Board Game", "Puzzle", "Soft Toy", "Robot Kit"], variants: ["3+ yrs", "5+ yrs", "8+ yrs"], price: [149, 4999] },
  "kids-clothing": { count: 240, brands: ["nike", "adidas", "puma"], adj: ["Cotton", "Printed", "Cartoon", "Casual"], types: ["T-Shirt Pack", "Frock", "Shorts Set", "Night Suit", "Jeans"], variants: ["2-3Y", "4-5Y", "6-7Y", "8-9Y"], price: [199, 1999] },
  "baby-care": { count: 70, brands: [], adj: ["Gentle", "Organic", "Soft"], types: ["Diapers Pack", "Baby Wipes", "Feeding Bottle", "Baby Lotion", "Stroller", "Baby Carrier"], variants: ["S", "M", "L", "XL"], price: [99, 12999] },
  "school-supplies": { count: 60, brands: [], adj: ["Premium", "Jumbo", "Classic"], types: ["Notebook Pack", "Geometry Box", "Pen Set", "Crayons Set", "School Bag", "Lunch Box", "Water Bottle"], variants: ["Pack of 3", "Pack of 6", "Pack of 12"], price: [49, 1499] },
};

const COLORS = ["black", "white", "blue", "red", "green", "grey", "brown", "silver", "pink", "yellow"];
const slugify = (s) => s.toLowerCase().replace(/["'\/]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Seeded shuffle — "newest" listing me categories mix dikhein (ek hi category ka dher nahi).
function shuffle(arr) {
  let s = 42;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function main() {
  const cats = await prisma.category.findMany({
    where: { parentId: { not: null } },
    select: { id: true, slug: true },
  });
  const catBySlug = Object.fromEntries(cats.map((c) => [c.slug, c]));
  const brands = await prisma.brand.findMany({ select: { id: true, slug: true, name: true } });
  const brandBySlug = Object.fromEntries(brands.map((b) => [b.slug, b]));

  const rows = [];
  for (const [slug, r] of Object.entries(RECIPES)) {
    const cat = catBySlug[slug];
    if (!cat) { console.warn(`skip ${slug} — category missing (run npm run seed)`); continue; }
    const hasColor = !NO_COLOR.has(slug);
    const tl = r.types.length, al = r.adj.length, bl = r.brands.length || 1;
    const vl = r.variants.length, cl = hasColor ? COLORS.length : 1;

    for (let k = 0; k < r.count; k++) {
      // Mixed-radix enumeration — k ke har value pe alag combo (duplicate naam impossible
      // jab tak count <= tl*al*bl*vl*cl; tagged categories me model code ne guarantee di).
      const type = r.types[k % tl];
      const adj = r.adj[Math.floor(k / tl) % al];
      const brand = r.brands.length ? brandBySlug[r.brands[Math.floor(k / (tl * al)) % bl]] : undefined;
      const variant = r.variants[Math.floor(k / (tl * al * bl)) % vl];
      const color = hasColor ? COLORS[Math.floor(k / (tl * al * bl * vl)) % cl] : null;
      const tag = r.tag ? ` ${r.tag}${100 + k}` : "";

      const name = `${brand ? brand.name + " " : ""}${adj} ${type}${tag} (${color ? `${color}, ` : ""}${variant})`;
      const priceRupees = r.price[0] + Math.floor(Math.random() * (r.price[1] - r.price[0]));
      rows.push({
        name,
        slug: slugify(name),
        description: `${name} — genuine quality ${type.toLowerCase()}${color ? ` in ${color}` : ""}. Best price on Shivani Mart with fast delivery and easy returns.`,
        pricePaise: priceRupees * 100,
        discountPercent: [0, 5, 10, 15, 20, 25, 30, 40, 50][k % 9],
        stock: Math.random() < 0.03 ? 0 : 5 + Math.floor(Math.random() * 300),
        color,
        categoryId: cat.id,
        brandId: brand?.id ?? null,
        isTrending: k % 997 === 0,
        images: productImages(slug, k),
      });
    }
  }

  shuffle(rows);
  console.log(`Inserting ${rows.length.toLocaleString()} products (unique names)...`);
  const BATCH = 5000;
  const t0 = Date.now();
  for (let i = 0; i < rows.length; i += BATCH) {
    await prisma.product.createMany({ data: rows.slice(i, i + BATCH), skipDuplicates: true });
    process.stdout.write(`  ${Math.min(i + BATCH, rows.length).toLocaleString()}/${rows.length.toLocaleString()} (${((Date.now() - t0) / 1000).toFixed(0)}s)\r\n`);
  }

  const count = await prisma.product.count();
  console.log(`Done. Total products in DB: ${count.toLocaleString()}`);

  // Redis data-cache clear — naya catalog turant dikhe.
  try {
    const Redis = require("ioredis");
    const r = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { lazyConnect: true });
    await r.connect();
    const keys = await r.keys("*");
    const targets = keys.filter(
      (k) => k === "home:data" || k === "categories:tree" || k === "brands:all" || k.startsWith("plist:") || k.startsWith("pfacets:") || k.startsWith("product:")
    );
    if (targets.length) await r.del(...targets);
    r.disconnect();
    console.log(`Cache cleared: ${targets.length} keys`);
  } catch {
    console.log("Cache clear skipped (Redis down) — TTL khud expire karega.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
