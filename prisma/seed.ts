import "dotenv/config";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { finalPrice } from "../src/utils/price";
import { buildCatalog, CATEGORIES } from "./catalog";

if (process.env.NODE_ENV !== "development") {
  console.error("Seed sirf NODE_ENV=development me chalta hai (ye poora DB saaf karta hai).");
  process.exit(1);
}

const prisma = new PrismaClient();

// A placeholder image URL that is always the same for the same slug and number.
function imageUrl(slug: string, imageNumber: number): string {
  return `https://picsum.photos/seed/${slug}-${imageNumber}/600/600`;
}

let seedState = 20260920;
// A random number from 0 to 1 that repeats on every run (mulberry32), so the demo data is always the same.
function random(): number {
  seedState = (seedState + 0x6d2b79f5) | 0;
  let value = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

// One random item of the list.
function pick<T>(list: readonly T[]): T {
  return list[Math.floor(random() * list.length)];
}

// A random whole number from min to max.
function between(min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1));
}

// True in about `percent` out of 100 calls.
function chance(percent: number) {
  return random() * 100 < percent;
}

// "Men's Shoes" -> "mens-shoes".
function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// The date that many days from now.
function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// The date that many days ago.
function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

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
  { city: "Varanasi", state: "Uttar Pradesh", pincode: "221001" },
  { city: "Lucknow", state: "Uttar Pradesh", pincode: "226001" },
  { city: "Ghazipur", state: "Uttar Pradesh", pincode: "233001" },
  { city: "Patna", state: "Bihar", pincode: "800001" },
  { city: "Delhi", state: "Delhi", pincode: "110001" },
  { city: "Jaipur", state: "Rajasthan", pincode: "302001" },
  { city: "Pune", state: "Maharashtra", pincode: "411001" },
  { city: "Bengaluru", state: "Karnataka", pincode: "560001" },
  { city: "Hyderabad", state: "Telangana", pincode: "500001" },
  { city: "Indore", state: "Madhya Pradesh", pincode: "452001" },
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

const TOTAL_PRODUCTS = Number(process.env.SEED_PRODUCTS ?? 5000);
const TOTAL_USERS = 500;
const TOTAL_ORDERS = 3000;
const BATCH_SIZE = 1000;
const SUPER_ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE ?? "9876543210";

if (!Number.isInteger(TOTAL_PRODUCTS) || TOTAL_PRODUCTS < 1000 || TOTAL_PRODUCTS > 50000) {
  console.error("SEED_PRODUCTS 1000 se 50000 ke beech hona chahiye.");
  process.exit(1);
}

// Deletes every row, children before parents.
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

// Inserts rows 1,000 at a time.
async function insertInBatches<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    await insert(rows.slice(start, start + BATCH_SIZE));
  }
}

// Wipes the database and fills it with categories, brands, SEED_PRODUCTS (default 5,000) products, users, orders, reviews.
async function main() {
  console.log("Purana data hata rahe hain...");
  await clearAll();

  const categoryIds = new Map<string, string>();
  const parentRows = [];
  const childRows = [];
  for (const parent of CATEGORIES) {
    const parentId = randomUUID();
    parentRows.push({
      id: parentId,
      name: parent.name,
      slug: slugify(parent.name),
      image: imageUrl(slugify(parent.name), 0),
    });
    for (const child of parent.children) {
      const childId = randomUUID();
      categoryIds.set(child.name, childId);
      childRows.push({
        id: childId,
        name: child.name,
        slug: slugify(child.name),
        image: imageUrl(slugify(child.name), 0),
        parentId,
      });
    }
  }
  await prisma.category.createMany({ data: parentRows });
  await prisma.category.createMany({ data: childRows });
  console.log(`Category: ${parentRows.length} parent + ${childRows.length} subcategory`);

  const catalog = buildCatalog(TOTAL_PRODUCTS, random);
  const brandIds = new Map([...new Set(catalog.map((item) => item.brand))].map((name) => [name, randomUUID()]));
  await prisma.brand.createMany({
    data: [...brandIds].map(([name, id]) => ({ id, name, slug: slugify(name), logo: imageUrl(slugify(name), 0) })),
  });
  console.log(`Brand: ${brandIds.size}`);

  const usedSlugs = new Set<string>();
  const products = catalog.map((item, index) => {
    const baseSlug = slugify(item.name);
    const slug = usedSlugs.has(baseSlug) ? `${baseSlug}-${index}` : baseSlug;
    usedSlugs.add(slug);

    const [offerChance, minDiscount, maxDiscount] = item.discount;
    const pricePaise = item.price * 100;
    const discountPercent = chance(offerChance) ? between(minDiscount, maxDiscount) : 0;
    const offerEndsAt = discountPercent > 0 && chance(35) ? daysFromNow(between(2, 45)) : null;

    return {
      id: randomUUID(),
      name: item.name,
      slug,
      description: item.description,
      specs: item.specs,
      pricePaise,
      discountPercent,
      sellPaise: finalPrice(pricePaise, discountPercent),
      offerEndsAt,
      stock: chance(5) ? 0 : chance(10) ? between(1, 5) : between(10, 300),
      colors: item.colors,
      sizes: item.sizes,
      gender: item.gender,
      ageGroup: item.ageGroup,
      images: [1, 2, 3, 4].map((imageNumber) => imageUrl(slug, imageNumber)),
      categoryId: categoryIds.get(item.category)!,
      brandId: brandIds.get(item.brand)!,
      isActive: !chance(3),
      isTrending: chance(5),
      isFeatured: chance(5),
      ratingSum: 0,
      ratingCount: 0,
      ratingAverage: 0,
    };
  });

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

    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    users.push({
      id: randomUUID(),
      phone,
      name: `${firstName} ${lastName}`,
      email: chance(60) ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}${users.length}@example.com` : null,
      role: "USER" as const,
    });
  }

  for (const user of users) {
    const howMany = chance(35) ? 2 : 1;
    for (let addressNumber = 0; addressNumber < howMany; addressNumber++) {
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
        pincode: place.pincode,
        isDefault: addressNumber === 0,
      });
    }
  }

  const orders = [];
  const orderItems = [];
  const deliveredPairs: { userId: string; productId: string }[] = [];
  const liveProducts = products.filter((product) => product.isActive);
  const popular = liveProducts.slice(0, 2000);

  const customers = users.filter((user) => user.role === "USER");
  for (let orderNumber = 0; orderNumber < TOTAL_ORDERS; orderNumber++) {
    const user = pick(customers);
    const userAddresses = addresses.filter((address) => address.userId === user.id);
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

    for (let itemNumber = 0; itemNumber < howManyItems; itemNumber++) {
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
      idempotencyKey: `seed-${orderNumber}-${orderId.slice(0, 8)}`,
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
      razorpayOrderId: paymentMethod === "ONLINE" ? `order_seed${orderNumber}${orderId.slice(0, 6)}` : null,
      razorpayPaymentId: paymentMethod === "ONLINE" && paymentStatus === "COMPLETED" ? `pay_seed${orderNumber}` : null,
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
    { text: "Fashion Under 999", link: "/products?category=womens-fashion&maxPrice=999" },
    { text: "Laptop Deals", link: "/products?category=laptops" },
    { text: "Daily Grocery", link: "/products?category=grocery" },
  ].map((banner, position) => ({
    id: randomUUID(),
    image: imageUrl(slugify(banner.text), 0),
    link: banner.link,
    position,
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
