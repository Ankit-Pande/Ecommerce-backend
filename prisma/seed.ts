import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Seed — super admin + REAL-looking demo catalog (100+ products, full category tree,
// brands, banners). Idempotent: dobara chalao to duplicate nahi banega.

// Real topical images — Unsplash CDN (stable, category-relevant photos).
const uns = (id: string, w: number, extra = "") =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop${extra}`;

// Subcategory slug -> relevant Unsplash photo id.
const SUBCAT_IMG: Record<string, string> = {
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
// Parent category slug -> representative image.
const CAT_IMG: Record<string, string> = {
  electronics: "1516035069371-29a1b244cc32",
  fashion: "1483985988355-763728e1935b",
  "home-furniture": "1555041469-a586c61ea9bc",
  grocery: "1542838132-92c53300491e",
  appliances: "1593359677879-a4bb92f829d1",
  books: "1544716278-ca5e3f4abd8c",
  "toys-kids": "1566576912321-d58ddd7a6088",
};
// Wide promo banners.
const BANNER_IDS = [
  "1441986300917-64674bd600d8",
  "1607082348824-0a96f2a4b9da",
  "1595777457583-95e059d581b8",
  "1566576912321-d58ddd7a6088", // toys & kids
  "1512820790803-83ca734da794", // books
];

const catImage = (slug: string) =>
  uns(CAT_IMG[slug] ?? SUBCAT_IMG[slug] ?? "1441986300917-64674bd600d8", 600);
// Product gallery — subcategory image ke 3 variants (thumbnails alag dikhein).
const productImages = (subcatSlug: string): string[] => {
  const id = SUBCAT_IMG[subcatSlug] ?? "1441986300917-64674bd600d8";
  return [uns(id, 700), uns(id, 700, "&flip=h"), uns(id, 700, "&sat=-60")];
};

// ---------- Category tree (parent -> children) ----------
const CATEGORY_TREE: { name: string; slug: string; children: { name: string; slug: string }[] }[] = [
  {
    name: "Electronics", slug: "electronics",
    children: [
      { name: "Mobiles", slug: "mobiles" },
      { name: "Laptops", slug: "laptops" },
      { name: "Headphones", slug: "headphones" },
      { name: "Cameras", slug: "cameras" },
      { name: "Smart Watches", slug: "smart-watches" },
    ],
  },
  {
    name: "Fashion", slug: "fashion",
    children: [
      { name: "Men's Clothing", slug: "mens-clothing" },
      { name: "Women's Clothing", slug: "womens-clothing" },
      { name: "Footwear", slug: "footwear" },
      { name: "Watches", slug: "watches" },
      { name: "Bags & Backpacks", slug: "bags-backpacks" },
    ],
  },
  {
    name: "Home & Furniture", slug: "home-furniture",
    children: [
      { name: "Furniture", slug: "furniture" },
      { name: "Kitchen & Dining", slug: "kitchen-dining" },
      { name: "Home Decor", slug: "home-decor" },
      { name: "Bedding", slug: "bedding" },
    ],
  },
  {
    name: "Grocery", slug: "grocery",
    children: [
      { name: "Staples", slug: "staples" },
      { name: "Snacks & Beverages", slug: "snacks-beverages" },
      { name: "Personal Care", slug: "personal-care" },
    ],
  },
  {
    name: "Appliances", slug: "appliances",
    children: [
      { name: "Televisions", slug: "televisions" },
      { name: "Refrigerators", slug: "refrigerators" },
      { name: "Washing Machines", slug: "washing-machines" },
      { name: "Kitchen Appliances", slug: "kitchen-appliances" },
    ],
  },
  {
    name: "Books", slug: "books",
    children: [
      { name: "Fiction", slug: "fiction" },
      { name: "Non-Fiction", slug: "non-fiction" },
      { name: "Children's Books", slug: "childrens-books" },
    ],
  },
  {
    name: "Toys & Kids", slug: "toys-kids",
    children: [
      { name: "Toys & Games", slug: "toys-games" },
      { name: "Kids Clothing", slug: "kids-clothing" },
      { name: "Baby Care", slug: "baby-care" },
      { name: "School Supplies", slug: "school-supplies" },
    ],
  },
];

// ---------- Brands ----------
const BRANDS: { name: string; slug: string }[] = [
  "Samsung", "Apple", "OnePlus", "Xiaomi", "Realme", "Sony", "boAt", "JBL",
  "HP", "Dell", "Lenovo", "Asus", "Acer", "Nike", "Adidas", "Puma", "Levi's",
  "Titan", "Fastrack", "Nestlé", "Amul", "Tata", "Prestige", "LG", "Whirlpool",
  "Bosch", "Canon", "Nikon", "Penguin", "HarperCollins", "American Tourister",
  "Wildcraft", "Philips", "Bajaj",
  "Lego", "Hot Wheels", "Funskool", "Mattel", "Pampers", "Johnson's", "Chicco",
].map((name) => ({
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
}));

// ---------- Products ----------
// [name, subcategorySlug, brandSlug, priceRupees, discountPercent, color, trending?]
type P = [string, string, string | null, number, number, string | null, boolean?];
const PRODUCTS: P[] = [
  // Mobiles
  ["Samsung Galaxy S24 Ultra", "mobiles", "samsung", 124999, 12, "black", true],
  ["Samsung Galaxy S24", "mobiles", "samsung", 74999, 10, "black", true],
  ["Samsung Galaxy A55 5G", "mobiles", "samsung", 39999, 8, "blue"],
  ["Apple iPhone 15 Pro Max", "mobiles", "apple", 159900, 5, "titanium", true],
  ["Apple iPhone 15", "mobiles", "apple", 79900, 6, "blue", true],
  ["Apple iPhone 14", "mobiles", "apple", 69900, 9, "midnight"],
  ["OnePlus 12 5G", "mobiles", "oneplus", 64999, 11, "green", true],
  ["OnePlus Nord CE4", "mobiles", "oneplus", 24999, 10, "gray"],
  ["Xiaomi 14 Pro", "mobiles", "xiaomi", 49999, 15, "black"],
  ["Redmi Note 13 Pro+", "mobiles", "xiaomi", 31999, 14, "purple"],
  ["Realme 12 Pro+ 5G", "mobiles", "realme", 29999, 13, "blue"],
  ["Realme Narzo 70", "mobiles", "realme", 15999, 12, "green"],
  // Laptops
  ["Apple MacBook Air M3", "laptops", "apple", 114900, 7, "silver", true],
  ["Apple MacBook Pro 14 M3", "laptops", "apple", 169900, 5, "space-gray"],
  ["HP Pavilion 15", "laptops", "hp", 62999, 18, "silver"],
  ["HP Victus Gaming", "laptops", "hp", 71999, 16, "black", true],
  ["Dell Inspiron 15", "laptops", "dell", 54999, 20, "black"],
  ["Dell XPS 13", "laptops", "dell", 129999, 10, "silver"],
  ["Lenovo IdeaPad Slim 5", "laptops", "lenovo", 58999, 17, "gray"],
  ["Lenovo Legion 5 Pro", "laptops", "lenovo", 139999, 12, "black", true],
  ["Asus ROG Strix G16", "laptops", "asus", 154999, 9, "black"],
  ["Asus VivoBook 15", "laptops", "asus", 44999, 22, "blue"],
  ["Acer Aspire 7", "laptops", "acer", 49999, 19, "black"],
  // Headphones
  ["Sony WH-1000XM5", "headphones", "sony", 29990, 15, "black", true],
  ["Sony WF-1000XM5 Buds", "headphones", "sony", 24990, 12, "black"],
  ["boAt Rockerz 450", "headphones", "boat", 1499, 40, "blue", true],
  ["boAt Airdopes 141", "headphones", "boat", 1299, 55, "white", true],
  ["JBL Tune 770NC", "headphones", "jbl", 8999, 25, "black"],
  ["JBL Flip 6 Speaker", "headphones", "jbl", 9999, 20, "teal"],
  ["Apple AirPods Pro 2", "headphones", "apple", 24900, 8, "white", true],
  // Cameras
  ["Canon EOS R50 Mirrorless", "cameras", "canon", 67999, 10, "black"],
  ["Canon EOS 1500D DSLR", "cameras", "canon", 38999, 14, "black"],
  ["Nikon Z30 Vlogging Kit", "cameras", "nikon", 61999, 11, "black"],
  ["Nikon D3500 DSLR", "cameras", "nikon", 41999, 13, "black"],
  ["Sony Alpha ZV-E10", "cameras", "sony", 58999, 9, "black", true],
  // Smart Watches
  ["Apple Watch Series 9", "smart-watches", "apple", 41900, 6, "midnight", true],
  ["Samsung Galaxy Watch 6", "smart-watches", "samsung", 29999, 15, "graphite"],
  ["boAt Wave Call 2", "smart-watches", "boat", 1599, 50, "black", true],
  ["Fastrack Reflex Play+", "smart-watches", "fastrack", 2495, 35, "black"],
  ["Titan Smart 2", "smart-watches", "titan", 4995, 28, "silver"],
  // Men's Clothing
  ["Levi's 511 Slim Jeans", "mens-clothing", "levi-s", 3299, 30, "blue", true],
  ["Levi's Cotton Crew Tee", "mens-clothing", "levi-s", 999, 40, "white"],
  ["Nike Dri-FIT T-Shirt", "mens-clothing", "nike", 1495, 25, "black"],
  ["Adidas Essentials Hoodie", "mens-clothing", "adidas", 2999, 35, "gray"],
  ["Puma Track Jacket", "mens-clothing", "puma", 2499, 38, "navy"],
  ["Puma Graphic Tee", "mens-clothing", "puma", 899, 45, "red"],
  // Women's Clothing
  ["Levi's High-Rise Jeans", "womens-clothing", "levi-s", 3499, 32, "blue"],
  ["Nike Sportswear Leggings", "womens-clothing", "nike", 2295, 20, "black", true],
  ["Adidas Running Tee", "womens-clothing", "adidas", 1799, 30, "pink"],
  ["Puma Active Shorts", "womens-clothing", "puma", 1299, 35, "gray"],
  // Footwear
  ["Nike Air Max 270", "footwear", "nike", 12995, 20, "white", true],
  ["Nike Revolution 7", "footwear", "nike", 4995, 30, "black"],
  ["Adidas Ultraboost Light", "footwear", "adidas", 15999, 18, "black", true],
  ["Adidas Grand Court", "footwear", "adidas", 4599, 33, "white"],
  ["Puma Smash V2", "footwear", "puma", 3499, 40, "white"],
  ["Puma Softride Runner", "footwear", "puma", 3999, 35, "blue"],
  // Watches
  ["Titan Neo Analog", "watches", "titan", 4995, 25, "silver"],
  ["Fastrack Stunners", "watches", "fastrack", 2295, 35, "black"],
  ["Titan Edge Slim", "watches", "titan", 12995, 15, "gold"],
  // Bags & Backpacks
  ["American Tourister Backpack 32L", "bags-backpacks", "american-tourister", 2499, 45, "blue", true],
  ["Wildcraft Trekking Rucksack 45L", "bags-backpacks", "wildcraft", 3499, 30, "green"],
  ["American Tourister Cabin Trolley", "bags-backpacks", "american-tourister", 6999, 40, "red"],
  ["Wildcraft Laptop Backpack", "bags-backpacks", "wildcraft", 1999, 35, "black"],
  // Furniture
  ["Sheesham Wood 3-Seater Sofa", "furniture", null, 34999, 25, "brown", true],
  ["Engineered Wood Study Table", "furniture", null, 6999, 30, "walnut"],
  ["Ergonomic Office Chair", "furniture", null, 8999, 35, "black", true],
  ["Queen Size Bed with Storage", "furniture", null, 24999, 22, "brown"],
  ["Bookshelf 5-Tier", "furniture", null, 4999, 28, "oak"],
  ["Foldable Dining Table Set", "furniture", null, 15999, 20, "brown"],
  // Kitchen & Dining
  ["Prestige Induction Cooktop", "kitchen-dining", "prestige", 3499, 30, "black", true],
  ["Prestige Non-Stick Cookware Set", "kitchen-dining", "prestige", 2999, 35, "black"],
  ["Stainless Steel Dinner Set 24pc", "kitchen-dining", "tata", 3999, 25, "silver"],
  ["Bajaj Mixer Grinder 750W", "kitchen-dining", "bajaj", 3299, 32, "white"],
  ["Borosilicate Glass Jar Set", "kitchen-dining", null, 1299, 40, "clear"],
  // Home Decor
  ["Abstract Canvas Wall Art", "home-decor", null, 1999, 45, "multi"],
  ["LED String Lights 10m", "home-decor", null, 599, 50, "warm"],
  ["Ceramic Table Vase", "home-decor", null, 899, 38, "white"],
  ["Cotton Area Rug 5x7", "home-decor", null, 3499, 30, "beige"],
  // Bedding
  ["Cotton King Bedsheet Set", "bedding", null, 1799, 40, "blue", true],
  ["Microfiber Pillow Pack of 2", "bedding", null, 999, 45, "white"],
  ["Reversible AC Comforter", "bedding", null, 2499, 35, "gray"],
  // Staples
  ["Tata Sampann Toor Dal 1kg", "staples", "tata", 199, 10, null],
  ["Aashirvaad Atta 5kg", "staples", "tata", 299, 8, null, true],
  ["Fortune Sunflower Oil 1L", "staples", null, 179, 12, null],
  ["Daawat Basmati Rice 5kg", "staples", null, 649, 15, null],
  // Snacks & Beverages
  ["Nestlé Maggi Noodles 12-Pack", "snacks-beverages", "nestle", 168, 12, null, true],
  ["Nestlé KitKat Pack of 10", "snacks-beverages", "nestle", 250, 15, null],
  ["Amul Dark Chocolate 150g", "snacks-beverages", "amul", 120, 10, null],
  ["Tata Tea Gold 500g", "snacks-beverages", "tata", 275, 14, null],
  ["Amul Cheese Cubes 200g", "snacks-beverages", "amul", 145, 8, null],
  // Personal Care
  ["Philips Beard Trimmer", "personal-care", "philips", 1495, 35, "black", true],
  ["Philips Hair Dryer 1200W", "personal-care", "philips", 1299, 30, "pink"],
  ["Dove Body Wash 800ml", "personal-care", null, 499, 25, null],
  // Televisions
  ["Sony Bravia 55\" 4K OLED", "televisions", "sony", 139900, 18, "black", true],
  ["Samsung Crystal 50\" 4K UHD", "televisions", "samsung", 44999, 30, "black", true],
  ["LG 43\" Full HD Smart TV", "televisions", "lg", 32999, 28, "black"],
  ["Xiaomi Smart TV X 55", "televisions", "xiaomi", 38999, 25, "black"],
  // Refrigerators
  ["LG 260L Double Door Fridge", "refrigerators", "lg", 27999, 22, "silver", true],
  ["Samsung 253L Frost-Free", "refrigerators", "samsung", 26999, 20, "gray"],
  ["Whirlpool 190L Single Door", "refrigerators", "whirlpool", 15999, 25, "blue"],
  ["Bosch 288L Double Door", "refrigerators", "bosch", 33999, 18, "steel"],
  // Washing Machines
  ["LG 7kg Front Load Washer", "washing-machines", "lg", 32999, 20, "white", true],
  ["Samsung 6.5kg Top Load", "washing-machines", "samsung", 15999, 25, "gray"],
  ["Bosch 7kg Front Load", "washing-machines", "bosch", 29999, 22, "silver"],
  ["Whirlpool 7.5kg Top Load", "washing-machines", "whirlpool", 17999, 24, "white"],
  // Kitchen Appliances
  ["Bajaj 1.8L Electric Kettle", "kitchen-appliances", "bajaj", 899, 40, "steel"],
  ["Philips Air Fryer 4.1L", "kitchen-appliances", "philips", 8999, 30, "black", true],
  ["Prestige 6L Pressure Cooker", "kitchen-appliances", "prestige", 1799, 28, "silver"],
  ["Bajaj OTG 16L Oven", "kitchen-appliances", "bajaj", 3499, 32, "black"],
  // Fiction
  ["The Silent Patient", "fiction", "harpercollins", 399, 30, null],
  ["It Ends With Us", "fiction", "penguin", 299, 35, null, true],
  ["The Alchemist", "fiction", "harpercollins", 350, 25, null, true],
  ["A Court of Thorns and Roses", "fiction", "penguin", 499, 28, null],
  // Non-Fiction
  ["Atomic Habits", "non-fiction", "penguin", 599, 40, null, true],
  ["Ikigai", "non-fiction", "penguin", 299, 33, null],
  ["Sapiens: A Brief History", "non-fiction", "harpercollins", 699, 30, null],
  ["Rich Dad Poor Dad", "non-fiction", "penguin", 349, 38, null],
  // Children's Books
  ["The Very Hungry Caterpillar", "childrens-books", "penguin", 250, 30, null],
  ["Wings of Fire (Set)", "childrens-books", "harpercollins", 999, 35, null],
  ["Amar Chitra Katha Collection", "childrens-books", null, 1499, 40, null, true],
  // Toys & Games
  ["Lego Classic Creative Bricks", "toys-games", "lego", 2999, 25, "multi", true],
  ["Lego City Police Station", "toys-games", "lego", 5999, 20, "multi"],
  ["Hot Wheels 20-Car Gift Pack", "toys-games", "hot-wheels", 1499, 30, "multi", true],
  ["Hot Wheels Track Builder Set", "toys-games", "hot-wheels", 1999, 28, "orange"],
  ["Funskool Giant Jenga", "toys-games", "funskool", 899, 35, "brown"],
  ["Mattel UNO Card Game", "toys-games", "mattel", 299, 40, "multi", true],
  ["Barbie Dreamhouse Doll", "toys-games", "mattel", 3499, 22, "pink"],
  ["Remote Control Racing Car", "toys-games", "funskool", 1799, 33, "red"],
  // Kids Clothing
  ["Kids Cotton T-Shirt Pack of 3", "kids-clothing", null, 799, 40, "multi", true],
  ["Boys Denim Dungaree", "kids-clothing", null, 1199, 35, "blue"],
  ["Girls Floral Frock", "kids-clothing", null, 999, 38, "pink"],
  ["Kids Winter Hoodie", "kids-clothing", null, 1299, 30, "gray"],
  // Baby Care
  ["Pampers Diapers Pants (M, 72)", "baby-care", "pampers", 1399, 20, null, true],
  ["Johnson's Baby Care Gift Set", "baby-care", "johnson-s", 899, 25, null],
  ["Chicco Baby Feeding Bottle 250ml", "baby-care", "chicco", 449, 30, null],
  ["Chicco Baby Stroller", "baby-care", "chicco", 8999, 18, "gray", true],
  // School Supplies
  ["Kids School Backpack", "school-supplies", null, 899, 40, "blue", true],
  ["Geometry Box Set", "school-supplies", null, 199, 35, null],
  ["Crayons & Sketch Pens Combo", "school-supplies", null, 349, 45, "multi"],
  ["Insulated Steel Lunch Box", "school-supplies", null, 599, 30, "green"],
];

async function main() {
  // 1. Super admin.
  const superAdminPhone = process.env.SUPER_ADMIN_PHONE;
  if (superAdminPhone) {
    const p = superAdminPhone.length === 10 ? `91${superAdminPhone}` : superAdminPhone;
    await prisma.user.upsert({
      where: { phone: p },
      create: { phone: p, name: "Super Admin", role: "SUPER_ADMIN" },
      update: { role: "SUPER_ADMIN" },
    });
    console.log(`Super admin set: ${p}`);
  }

  // 2. Categories (parent + children). Build slug -> id map.
  const catId: Record<string, string> = {};
  for (const parent of CATEGORY_TREE) {
    const pc = await prisma.category.upsert({
      where: { slug: parent.slug },
      create: { name: parent.name, slug: parent.slug, image: catImage(parent.slug) },
      update: { image: catImage(parent.slug) },
    });
    catId[parent.slug] = pc.id;
    for (const child of parent.children) {
      const cc = await prisma.category.upsert({
        where: { slug: child.slug },
        create: { name: child.name, slug: child.slug, parentId: pc.id, image: catImage(child.slug) },
        update: { parentId: pc.id, image: catImage(child.slug) },
      });
      catId[child.slug] = cc.id;
    }
  }
  console.log(`Categories ready: ${Object.keys(catId).length}`);

  // 3. Brands.
  const brandId: Record<string, string> = {};
  for (const b of BRANDS) {
    const created = await prisma.brand.upsert({
      where: { slug: b.slug },
      create: { name: b.name, slug: b.slug },
      update: {},
    });
    brandId[b.slug] = created.id;
  }
  console.log(`Brands ready: ${Object.keys(brandId).length}`);

  // 4. Products — slugify name, skip if categoryId unknown, upsert on slug.
  let created = 0;
  for (const [name, catSlug, brandSlug, priceRupees, discount, color, trending] of PRODUCTS) {
    const categoryId = catId[catSlug];
    if (!categoryId) {
      console.warn(`Skip "${name}" — unknown category ${catSlug}`);
      continue;
    }
    const slug = name
      .toLowerCase()
      .replace(/["']/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const bId = brandSlug ? brandId[brandSlug] ?? null : null;

    await prisma.product.upsert({
      where: { slug },
      create: {
        name, slug,
        description: `${name} — premium quality at the best price on Shivani Mart. Genuine product with warranty and fast pan-India delivery.`,
        pricePaise: Math.round(priceRupees * 100),
        discountPercent: discount,
        stock: 20 + Math.floor(Math.random() * 180),
        color: color ?? undefined,
        categoryId,
        brandId: bId ?? undefined,
        isTrending: !!trending,
        images: productImages(catSlug),
      },
      update: {
        pricePaise: Math.round(priceRupees * 100),
        discountPercent: discount,
        categoryId,
        brandId: bId ?? undefined,
        isTrending: !!trending,
        // Re-seed pe purani (picsum) images ko real Unsplash se replace karo.
        images: productImages(catSlug),
      },
    });
    created++;
  }
  console.log(`Products upserted: ${created}`);

  // 5. Banners (promo carousel).
  const banners = [
    { image: uns(BANNER_IDS[0], 1400, "&h=460"), link: "/products?categoryId=" + catId["electronics"], position: 1 },
    { image: uns(BANNER_IDS[1], 1400, "&h=460"), link: "/products?categoryId=" + catId["fashion"], position: 2 },
    { image: uns(BANNER_IDS[2], 1400, "&h=460"), link: "/products?categoryId=" + catId["appliances"], position: 3 },
    { image: uns(BANNER_IDS[3], 1400, "&h=460"), link: "/products?categoryId=" + catId["toys-kids"], position: 4 },
    { image: uns(BANNER_IDS[4], 1400, "&h=460"), link: "/products?categoryId=" + catId["books"], position: 5 },
  ];
  // Purane (picsum) banners replace karo — real wide images daalo.
  await prisma.banner.deleteMany({});
  await prisma.banner.createMany({ data: banners });
  console.log(`Banners set: ${banners.length}`);

  const totalProducts = await prisma.product.count();
  console.log(`Seed complete. Total products in DB: ${totalProducts}`);

  // 6. Redis data-cache invalidate — warna home/categories purana data dikhayenge.
  try {
    const { default: Redis } = await import("ioredis");
    const r = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { lazyConnect: true });
    await r.connect();
    const keys = await r.keys("*");
    const targets = keys.filter(
      (k) => k === "home:data" || k === "categories:tree" || k === "brands:all" || k.startsWith("product:")
    );
    if (targets.length) await r.del(...targets);
    r.disconnect();
    console.log(`Cache cleared: ${targets.length} keys`);
  } catch {
    console.log("Cache clear skipped (Redis unavailable) — TTL will expire.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
