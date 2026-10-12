import "dotenv/config";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { finalPrice } from "../src/utils/price";

if (process.env.NODE_ENV !== "development") {
  console.error("Seed sirf NODE_ENV=development me chalta hai (ye poora DB saaf karta hai).");
  process.exit(1);
}

const prisma = new PrismaClient();

function imageUrl(slug: string, n: number): string {
  return `https://picsum.photos/seed/${slug}-${n}/600/600`;
}

let seedState = 20260920;
function random(): number {
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
const chance = (percent: number) => random() * 100 < percent;
const pickSome = <T>(list: readonly T[], count: number): T[] =>
  [...list].sort(() => random() - 0.5).slice(0, Math.min(count, list.length));

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

type Child = {
  name: string;
  items: readonly string[];
  price: [number, number];
  variantName?: string;
  variants?: readonly string[];
  sizes?: readonly string[];
  colors: readonly string[];
  specs: Record<string, readonly string[]>;
  about: string;
  gender?: "Men" | "Women" | "Unisex";
  ageGroup?: "Adult" | "Kids";
};

const CLOTH_SPECS = { Fabric: ["Cotton", "Cotton Blend", "Linen", "Rayon"], Fit: ["Regular", "Slim", "Relaxed"] };
const CLOTH_COLORS = [
  "Black",
  "White",
  "Navy Blue",
  "Red",
  "Grey",
  "Beige",
  "Olive Green",
  "Maroon",
  "Mustard",
  "Sky Blue",
  "Pink",
  "Brown",
];
const TOP_SIZES = ["S", "M", "L", "XL", "XXL"];
const KID_SIZES = ["2-3 Years", "4-5 Years", "6-7 Years", "8-9 Years", "10-11 Years"];

const CATALOG: { name: string; children: Child[] }[] = [
  {
    name: "Mobiles & Tablets",
    children: [
      {
        name: "Smartphones",
        items: ["Smartphone"],
        price: [6999, 89999],
        variantName: "Storage",
        variants: ["64GB", "128GB", "256GB", "512GB"],
        colors: ["Black", "White", "Sky Blue", "Olive Green", "Purple"],
        specs: {
          RAM: ["4GB", "6GB", "8GB", "12GB"],
          Battery: ["5000mAh", "6000mAh"],
          Camera: ["50MP", "64MP", "108MP"],
          Display: ["6.5 inch", "6.7 inch"],
        },
        about: "A smartphone with a bright AMOLED display, all-day battery and a dependable camera.",
      },
      {
        name: "Tablets",
        items: ["Tablet"],
        price: [9999, 64999],
        variantName: "Storage",
        variants: ["64GB", "128GB", "256GB"],
        colors: ["Grey", "Silver", "Sky Blue"],
        specs: {
          RAM: ["4GB", "6GB", "8GB"],
          Battery: ["7000mAh", "8000mAh"],
          Display: ["10.5 inch", "11 inch", "12.4 inch"],
        },
        about: "A light tablet for online classes, movies and note taking, with a long-lasting battery.",
      },
    ],
  },
  {
    name: "Laptops",
    children: [
      {
        name: "Everyday Laptops",
        items: ["Laptop"],
        price: [28999, 159999],
        variantName: "RAM",
        variants: ["8GB", "16GB", "32GB"],
        colors: ["Silver", "Grey", "Black"],
        specs: {
          Storage: ["512GB SSD", "1TB SSD"],
          Processor: ["Intel Core i5", "Intel Core i7", "AMD Ryzen 5", "AMD Ryzen 7"],
          Display: ["14 inch", "15.6 inch"],
        },
        about: "A thin and light laptop built for work, study and coding, with a battery that lasts the day.",
      },
      {
        name: "Gaming Laptops",
        items: ["Gaming Laptop"],
        price: [59999, 219999],
        variantName: "Graphics",
        variants: ["RTX 4050", "RTX 4060", "RTX 4070"],
        colors: ["Black", "Grey"],
        specs: {
          RAM: ["16GB", "32GB"],
          Storage: ["512GB SSD", "1TB SSD"],
          Processor: ["Intel Core i7", "AMD Ryzen 7", "Intel Core i9"],
          Display: ["144Hz", "165Hz"],
        },
        about: "High refresh rate display and a dedicated graphics card for games and video editing.",
      },
    ],
  },
  {
    name: "Audio & Wearables",
    children: [
      {
        name: "Headphones",
        items: ["Headphones"],
        price: [499, 24999],
        colors: ["Black", "White", "Navy Blue", "Red"],
        specs: {
          Type: ["Over-ear", "On-ear", "In-ear", "True Wireless"],
          Battery: ["20 hours", "30 hours", "40 hours"],
          Feature: ["Noise Cancelling", "Bass Boost", "Low Latency"],
        },
        about: "Clear sound with deep bass, a comfortable fit and a battery that lasts the whole week.",
      },
      {
        name: "Smart Watches",
        items: ["Smart Watch"],
        price: [1299, 29999],
        colors: ["Black", "Silver", "Pink", "Olive Green"],
        specs: {
          Display: ["1.4 inch AMOLED", "1.8 inch AMOLED", "1.9 inch LCD"],
          Battery: ["5 days", "7 days", "10 days"],
          Feature: ["Bluetooth Calling", "SpO2", "GPS"],
        },
        about: "Tracks steps, heart rate and sleep, shows notifications and takes Bluetooth calls.",
      },
    ],
  },
  {
    name: "Men's Fashion",
    children: [
      {
        name: "Men's Shirts",
        items: ["Shirt"],
        price: [699, 4999],
        sizes: TOP_SIZES,
        colors: CLOTH_COLORS,
        specs: CLOTH_SPECS,
        about: "A crisp shirt for the office on weekdays and parties on weekends.",
        gender: "Men",
        ageGroup: "Adult",
      },
      {
        name: "Men's T-Shirts",
        items: ["T-Shirt"],
        price: [349, 2499],
        sizes: TOP_SIZES,
        colors: CLOTH_COLORS,
        specs: CLOTH_SPECS,
        about: "Soft cotton that keeps its shape and colour after a full season of washing.",
        gender: "Men",
        ageGroup: "Adult",
      },
      {
        name: "Men's Jeans",
        items: ["Jeans"],
        price: [899, 5999],
        sizes: ["28", "30", "32", "34", "36", "38"],
        colors: ["Blue", "Black", "Grey", "Navy Blue"],
        specs: { Fit: ["Slim", "Regular", "Straight"] },
        about: "Stretchable denim that holds its shape through long days of sitting, walking and travelling.",
        gender: "Men",
        ageGroup: "Adult",
      },
      {
        name: "Men's Shoes",
        items: ["Shoes"],
        price: [799, 8999],
        sizes: ["6", "7", "8", "9", "10", "11"],
        colors: ["Black", "White", "Brown", "Grey", "Navy Blue"],
        specs: { Type: ["Sneakers", "Running", "Formal", "Casual"], Sole: ["Rubber", "EVA"] },
        about: "Cushioned sole and a breathable upper for all-day walking, running or office wear.",
        gender: "Men",
        ageGroup: "Adult",
      },
    ],
  },
  {
    name: "Women's Fashion",
    children: [
      {
        name: "Women's Kurtas",
        items: ["Kurta"],
        price: [599, 6999],
        sizes: TOP_SIZES,
        colors: CLOTH_COLORS,
        specs: CLOTH_SPECS,
        about: "A breathable kurta with clean stitching for office, festivals and weddings.",
        gender: "Women",
        ageGroup: "Adult",
      },
      {
        name: "Dresses",
        items: ["Dress"],
        price: [799, 7999],
        sizes: TOP_SIZES,
        colors: CLOTH_COLORS,
        specs: CLOTH_SPECS,
        about: "A party dress with a flattering drape that needs no ironing.",
        gender: "Women",
        ageGroup: "Adult",
      },
      {
        name: "Women's Tops",
        items: ["Top"],
        price: [399, 2999],
        sizes: TOP_SIZES,
        colors: CLOTH_COLORS,
        specs: CLOTH_SPECS,
        about: "Easy everyday top that pairs with jeans, skirts and palazzos.",
        gender: "Women",
        ageGroup: "Adult",
      },
      {
        name: "Women's Jeans",
        items: ["Women's Jeans"],
        price: [899, 4999],
        sizes: ["26", "28", "30", "32", "34"],
        colors: ["Blue", "Black", "Grey", "White"],
        specs: { Fit: ["Skinny", "Straight", "Wide Leg"] },
        about: "High-rise stretch jeans that stay comfortable from morning to evening.",
        gender: "Women",
        ageGroup: "Adult",
      },
      {
        name: "Sarees",
        items: ["Saree"],
        price: [799, 14999],
        colors: CLOTH_COLORS,
        specs: { Fabric: ["Silk", "Cotton", "Georgette", "Chiffon"], Occasion: ["Wedding", "Festive", "Daily Wear"] },
        about: "Graceful drape with a matching blouse piece for weddings, festivals and pujas.",
        gender: "Women",
        ageGroup: "Adult",
      },
      {
        name: "Women's Sandals",
        items: ["Sandals"],
        price: [399, 4999],
        sizes: ["4", "5", "6", "7", "8"],
        colors: ["Black", "Beige", "Brown", "Pink", "White"],
        specs: { Type: ["Flats", "Heels", "Wedges"], Sole: ["Rubber", "TPR"] },
        about: "Light and comfortable sandals with a soft footbed for daily wear and outings.",
        gender: "Women",
        ageGroup: "Adult",
      },
    ],
  },
  {
    name: "Kids Fashion",
    children: [
      {
        name: "Boys Clothing",
        items: ["Boys T-Shirt", "Boys Shirt", "Boys Jeans", "Boys Shorts"],
        price: [249, 1999],
        sizes: KID_SIZES,
        colors: CLOTH_COLORS,
        specs: { Fabric: ["Cotton", "Cotton Blend"] },
        about: "Skin-friendly cotton clothes that survive playground afternoons and the washing machine.",
        gender: "Men",
        ageGroup: "Kids",
      },
      {
        name: "Girls Clothing",
        items: ["Girls Frock", "Girls Top", "Girls Jeans", "Girls Leggings"],
        price: [299, 2999],
        sizes: KID_SIZES,
        colors: CLOTH_COLORS,
        specs: { Fabric: ["Cotton", "Rayon"] },
        about: "Soft, comfortable clothes for school, play and parties.",
        gender: "Women",
        ageGroup: "Kids",
      },
    ],
  },
];

const BRANDS = [
  "Voltro",
  "Nexora",
  "Urbanite",
  "Kestrel",
  "Zentra",
  "Auralis",
  "Pixelon",
  "Ironpeak",
  "Rangrez",
  "Tanvi",
  "Stonefield",
  "Lumora",
] as const;

const MODELS = [
  "Nova",
  "Pulse",
  "Aero",
  "Prime",
  "Edge",
  "Flux",
  "Astra",
  "Vertex",
  "Drift",
  "Crest",
  "Onyx",
  "Halo",
  "Terra",
  "Swift",
  "Lumen",
  "Arc",
  "Zen",
  "Bolt",
] as const;

const FIRST_NAMES = [
  "Ankit",
  "Priya",
  "Rahul",
  "Sneha",
  "Vikas",
  "Anjali",
  "Rohit",
  "Pooja",
  "Amit",
  "Neha",
  "Sandeep",
  "Kavita",
  "Manish",
  "Divya",
  "Arjun",
  "Meera",
  "Suresh",
  "Ritu",
  "Naveen",
  "Shreya",
] as const;

const LAST_NAMES = [
  "Pandey",
  "Sharma",
  "Verma",
  "Gupta",
  "Singh",
  "Yadav",
  "Mishra",
  "Joshi",
  "Nair",
  "Reddy",
  "Patel",
  "Das",
] as const;

const CITIES = [
  { city: "Varanasi", state: "Uttar Pradesh", pin: "221001" },
  { city: "Lucknow", state: "Uttar Pradesh", pin: "226001" },
  { city: "Ghazipur", state: "Uttar Pradesh", pin: "233001" },
  { city: "Patna", state: "Bihar", pin: "800001" },
  { city: "Delhi", state: "Delhi", pin: "110001" },
  { city: "Jaipur", state: "Rajasthan", pin: "302001" },
  { city: "Pune", state: "Maharashtra", pin: "411001" },
  { city: "Bengaluru", state: "Karnataka", pin: "560001" },
  { city: "Hyderabad", state: "Telangana", pin: "500001" },
  { city: "Indore", state: "Madhya Pradesh", pin: "452001" },
] as const;

const REVIEW_LINES = [
  "Exactly what the photos showed. Happy with the quality.",
  "Good for the price. Delivery was quicker than expected.",
  "Quality is decent but the size runs a little small.",
  "Using it for two weeks now, no complaints so far.",
  "Packaging was solid and nothing was damaged.",
  "Works well, though the finish could have been better.",
  "Worth the money. Would order from this brand again.",
  "Average product. Does the job but nothing special.",
  "Better than what I paid for. Recommended.",
  "Delivery was late but the product itself is fine.",
] as const;

const TOTAL_PRODUCTS = Number(process.env.SEED_PRODUCTS ?? 50000);
const TOTAL_USERS = 500;
const TOTAL_ORDERS = 3000;
const BATCH = 1000;
const SUPER_ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE ?? "9876543210";

async function clearAll() {
  await prisma.review.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.address.deleteMany();
  await prisma.session.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.product.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

async function insertInBatches<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await insert(rows.slice(i, i + BATCH));
  }
}

async function main() {
  console.log("Purana data hata rahe hain...");
  await clearAll();

  const parentRows = [];
  const childRows = [];
  const subCategories: { id: string; child: Child }[] = [];

  for (const parent of CATALOG) {
    const parentId = randomUUID();
    parentRows.push({
      id: parentId,
      name: parent.name,
      slug: slugify(parent.name),
      image: imageUrl(slugify(parent.name), 0),
      parentId: null,
    });

    for (const child of parent.children) {
      const childId = randomUUID();
      childRows.push({
        id: childId,
        name: child.name,
        slug: slugify(child.name),
        image: imageUrl(slugify(child.name), 0),
        parentId,
      });
      subCategories.push({ id: childId, child });
    }
  }

  await prisma.category.createMany({ data: parentRows });
  await prisma.category.createMany({ data: childRows });
  console.log(`Category: ${parentRows.length} parent + ${childRows.length} subcategory`);

  const brandRows = BRANDS.map((name) => ({
    id: randomUUID(),
    name,
    slug: slugify(name),
    logo: imageUrl(slugify(name), 0),
  }));
  await prisma.brand.createMany({ data: brandRows });
  console.log(`Brand: ${brandRows.length}`);

  const perCategory = Math.floor(TOTAL_PRODUCTS / subCategories.length);
  const usedSlugs = new Set<string>();
  const products = [];

  for (let c = 0; c < subCategories.length; c++) {
    const { id: categoryId, child } = subCategories[c];
    const count = c === 0 ? perCategory + (TOTAL_PRODUCTS % subCategories.length) : perCategory;

    for (let i = 0; i < count; i++) {
      const brand = pick(brandRows);
      const variant = child.variants ? pick(child.variants) : null;
      const colors = pickSome(child.colors, child.sizes ? between(2, 4) : between(1, 3));
      const someSizes = child.sizes?.filter(() => chance(85)) ?? [];
      const sizes = someSizes.length > 0 ? someSizes : [...(child.sizes ?? [])];

      const name = [brand.name, pick(MODELS), between(2, 99), pick(child.items), variant].filter(Boolean).join(" ");
      let slug = slugify(name);
      if (usedSlugs.has(slug)) slug = `${slug}-${products.length}`;
      usedSlugs.add(slug);

      const rupees = between(child.price[0], child.price[1]);
      const pricePaise = (Math.floor(rupees / 100) * 100 + 99) * 100;

      const discountPercent = chance(45) ? between(5, 60) : 0;
      const offerEndsAt = discountPercent > 0 && chance(35) ? daysFromNow(between(2, 45)) : null;
      const sellPaise = finalPrice(pricePaise, discountPercent);

      const stock = chance(5) ? 0 : chance(10) ? between(1, 5) : between(10, 300);
      const specs = Object.fromEntries(Object.entries(child.specs).map(([key, options]) => [key, pick(options)]));
      if (variant && child.variantName) specs[child.variantName] = variant;

      products.push({
        id: randomUUID(),
        name,
        slug,
        specs,
        description: [
          child.about,
          `Colours: ${colors.join(", ")}.`,
          sizes.length > 0 ? `Sizes: ${sizes.join(", ")}.` : "",
          `Brand: ${brand.name}. Ships in 2-5 days with easy returns on damaged items.`,
        ]
          .filter(Boolean)
          .join(" "),
        pricePaise,
        discountPercent,
        sellPaise,
        offerEndsAt,
        stock,
        colors,
        sizes,
        gender: child.gender ?? null,
        ageGroup: child.ageGroup ?? null,
        images: [1, 2, 3, 4].map((n) => imageUrl(slug, n)),
        categoryId,
        brandId: brand.id,
        isActive: !chance(3),
        isTrending: chance(5),
        isFeatured: chance(5),
        ratingSum: 0,
        ratingCount: 0,
        ratingAverage: 0,
      });
    }
  }

  const users = [];
  const addresses = [];
  const usedPhones = new Set<string>([SUPER_ADMIN_PHONE]);

  users.push({
    id: randomUUID(),
    phone: SUPER_ADMIN_PHONE,
    name: "Ankit Pandey",
    email: "admin@apnakart.test",
    role: "SUPER_ADMIN" as const,
  });

  while (users.length < TOTAL_USERS) {
    const phone = `${pick([6, 7, 8, 9])}${String(between(100000000, 999999999))}`;
    if (usedPhones.has(phone)) continue;
    usedPhones.add(phone);

    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    users.push({
      id: randomUUID(),
      phone,
      name: `${first} ${last}`,
      email: chance(60) ? `${first.toLowerCase()}.${last.toLowerCase()}${users.length}@example.com` : null,
      role: "USER" as const,
    });
  }

  for (const user of users) {
    const howMany = chance(35) ? 2 : 1;
    for (let i = 0; i < howMany; i++) {
      const place = pick(CITIES);
      addresses.push({
        id: randomUUID(),
        userId: user.id,
        fullName: user.name ?? "Customer",
        phone: user.phone,
        line1: `${between(1, 240)}, ${pick(["Gandhi Road", "Station Road", "MG Marg", "Civil Lines", "Nehru Nagar"])}`,
        line2: chance(50) ? `Near ${pick(["City Mall", "Post Office", "Bus Stand", "Govt School"])}` : null,
        city: place.city,
        state: place.state,
        pincode: place.pin,
        isDefault: i === 0,
      });
    }
  }

  const orders = [];
  const orderItems = [];
  const deliveredPairs: { userId: string; productId: string }[] = [];
  const liveProducts = products.filter((p) => p.isActive);
  const popular = liveProducts.slice(0, 2000);

  const customers = users.filter((u) => u.role === "USER");
  for (let i = 0; i < TOTAL_ORDERS; i++) {
    const user = pick(customers);
    const userAddresses = addresses.filter((a) => a.userId === user.id);
    const address = pick(userAddresses);

    const paymentMethod = chance(55) ? ("ONLINE" as const) : ("COD" as const);
    const picked = pick([
      "DELIVERED",
      "DELIVERED",
      "DELIVERED",
      "SHIPPED",
      "CONFIRMED",
      "PENDING",
      "CANCELLED",
    ] as const);
    const status = paymentMethod === "COD" && picked === "PENDING" ? "CONFIRMED" : picked;

    const paymentStatus =
      paymentMethod === "COD"
        ? status === "DELIVERED"
          ? ("COMPLETED" as const)
          : ("PENDING" as const)
        : status === "PENDING" || status === "CANCELLED"
          ? ("PENDING" as const)
          : ("COMPLETED" as const);

    const orderId = randomUUID();
    const createdAt = daysAgo(between(1, 120));

    let totalPaise = 0;
    const howManyItems = between(1, 4);
    const chosen = new Set<string>();

    for (let j = 0; j < howManyItems; j++) {
      const product = chance(45) ? pick(popular) : pick(liveProducts);
      if (chosen.has(product.id)) continue;
      chosen.add(product.id);

      const quantity = between(1, 3);
      if (status === "PENDING") {
        if (product.stock < quantity) continue;
        product.stock -= quantity;
      }
      const pricePaise = product.sellPaise;
      totalPaise += pricePaise * quantity;

      orderItems.push({
        id: randomUUID(),
        orderId,
        productId: product.id,
        productName: product.name,
        productImage: product.images[0],
        pricePaise,
        quantity,
        size: product.sizes.length > 0 ? pick(product.sizes) : null,
        color: product.colors.length > 0 ? pick(product.colors) : null,
      });

      if (status === "DELIVERED") deliveredPairs.push({ userId: user.id, productId: product.id });
    }
    if (totalPaise === 0) continue;

    orders.push({
      id: orderId,
      userId: user.id,
      idempotencyKey: `seed-${i}-${orderId.slice(0, 8)}`,
      addressId: address.id,
      shipName: address.fullName,
      shipPhone: address.phone,
      shipLine1: address.line1,
      shipLine2: address.line2,
      shipCity: address.city,
      shipState: address.state,
      shipPincode: address.pincode,
      totalPaise,
      status,
      paymentStatus,
      paymentMethod,
      paymentExpiresAt: paymentMethod === "ONLINE" && status === "PENDING" ? daysFromNow(0.02) : null,
      razorpayOrderId: paymentMethod === "ONLINE" ? `order_seed${i}${orderId.slice(0, 6)}` : null,
      razorpayPaymentId: paymentMethod === "ONLINE" && paymentStatus === "COMPLETED" ? `pay_seed${i}` : null,
      createdAt,
      updatedAt: createdAt,
    });
  }

  const reviews = [];
  const reviewed = new Set<string>();
  const ratingByProduct = new Map<string, { sum: number; count: number }>();

  for (const pair of deliveredPairs) {
    const key = `${pair.productId}:${pair.userId}`;
    if (reviewed.has(key)) continue;
    if (!chance(65)) continue;
    reviewed.add(key);

    const rating = chance(70) ? between(4, 5) : between(2, 3);
    const createdAt = daysAgo(between(1, 60));

    reviews.push({
      id: randomUUID(),
      productId: pair.productId,
      userId: pair.userId,
      rating,
      comment: chance(80) ? pick(REVIEW_LINES) : null,
      createdAt,
      updatedAt: createdAt,
    });

    const current = ratingByProduct.get(pair.productId) ?? { sum: 0, count: 0 };
    ratingByProduct.set(pair.productId, { sum: current.sum + rating, count: current.count + 1 });
  }

  for (const product of products) {
    const found = ratingByProduct.get(product.id);
    if (!found) continue;
    product.ratingSum = found.sum;
    product.ratingCount = found.count;
    product.ratingAverage = found.sum / found.count;
  }

  const banners = [
    { text: "Festive Sale", link: "/products?discount=true" },
    { text: "New Arrivals", link: "/products?sort=latest" },
    { text: "Trending Now", link: "/products?section=trending" },
    { text: "Laptop Deals", link: "/products?category=laptops" },
    { text: "Fashion Under 999", link: "/products?category=womens-fashion&maxPrice=999" },
    { text: "Kids Corner", link: "/products?category=kids-fashion" },
  ].map((banner, i) => ({
    id: randomUUID(),
    image: imageUrl(slugify(banner.text), 0),
    link: banner.link,
    position: i,
    isActive: true,
  }));

  await insertInBatches(products, (chunk) => prisma.product.createMany({ data: chunk }));
  console.log(`Product: ${products.length}`);

  await insertInBatches(users, (chunk) => prisma.user.createMany({ data: chunk }));
  await insertInBatches(addresses, (chunk) => prisma.address.createMany({ data: chunk }));
  console.log(`User: ${users.length} (address: ${addresses.length})`);

  await insertInBatches(orders, (chunk) => prisma.order.createMany({ data: chunk }));
  await insertInBatches(orderItems, (chunk) => prisma.orderItem.createMany({ data: chunk }));
  console.log(`Order: ${orders.length} (item: ${orderItems.length})`);

  await insertInBatches(reviews, (chunk) => prisma.review.createMany({ data: chunk }));
  console.log(`Review: ${reviews.length}`);

  await prisma.banner.createMany({ data: banners });
  console.log(`Banner: ${banners.length}`);

  console.log(`\nSeed poora hua. Admin login: ${SUPER_ADMIN_PHONE}`);
}

main()
  .catch((error) => {
    console.error("Seed fail hua:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
