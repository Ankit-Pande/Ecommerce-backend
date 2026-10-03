import "dotenv/config";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { finalPrice } from "../src/utils/price";

// Seed pehle poora DB saaf karta hai — live DB par galti se chala to saara asli data ud jaata.
if (process.env.NODE_ENV !== "development") {
  console.error("Seed sirf NODE_ENV=development me chalta hai (ye poora DB saaf karta hai).");
  process.exit(1);
}

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Product images
// ---------------------------------------------------------------------------
// Picsum asli photo deta hai aur hamesha chalta hai, par photo product se match
// nahi karegi. Asli photo Cloudinary par daalo to sirf ye ek function badlo.
function imageUrl(slug: string, n: number): string {
  return `https://picsum.photos/seed/${slug}-${n}/600/600`;
}

// ---------------------------------------------------------------------------
// Random — par har baar wahi
// ---------------------------------------------------------------------------
// Seed dobara chalao to bilkul wahi data bane, warna har run par catalog badal
// jaata aur "kal jo product dekha tha wo kahan gaya" wali dikkat hoti.
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

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

// ---------------------------------------------------------------------------
// Catalog ka dhancha
// ---------------------------------------------------------------------------
// price rupee me hai — neeche paise me badal dete hain.
// gender/ageGroup catalog filter ke liye: bacchon ke kapde me boys = Men, girls = Women + Kids.
// colors: [] matlab is cheez ka rang nahi hota (kitaab, masala) — tab color null.
type Child = {
  name: string;
  item: string; // product ke naam me jo shabd aayega
  price: [number, number];
  variants: readonly string[];
  about: string;
  gender?: "Men" | "Women" | "Unisex";
  ageGroup?: "Adult" | "Kids";
  colors?: readonly string[];
};

const CATALOG: { name: string; children: Child[] }[] = [
  {
    name: "Mobiles & Tablets",
    children: [
      { name: "Smartphones", item: "Smartphone", price: [7999, 89999], variants: ["64GB", "128GB", "256GB", "512GB"], about: "A smartphone with a bright AMOLED display, all-day battery and a dependable dual camera.", colors: ["Black", "White", "Sky Blue", "Olive Green"] },
      { name: "Tablets", item: "Tablet", price: [9999, 64999], variants: ["Wi-Fi 64GB", "Wi-Fi 128GB", "LTE 128GB"], about: "A light tablet for online classes, movies and note taking, with a long-lasting battery.", colors: ["Grey", "Silver", "Sky Blue"] },
      { name: "Feature Phones", item: "Feature Phone", price: [899, 3499], variants: ["Dual SIM", "Single SIM"], about: "A simple keypad phone with a loud speaker, torch and a battery that runs for days.", colors: ["Black", "Red", "Grey"] },
      { name: "Power Banks", item: "Power Bank", price: [599, 4999], variants: ["10000mAh", "20000mAh", "30000mAh"], about: "Fast-charging power bank with two outputs, safe enough to carry on a flight.", colors: ["Black", "White"] },
      { name: "Mobile Covers", item: "Mobile Cover", price: [149, 1499], variants: ["Silicone", "Hard Case", "Flip Cover"], about: "Shock-absorbing cover with raised edges that protect the screen and camera." },
    ],
  },
  {
    name: "Laptops & Computers",
    children: [
      { name: "Laptops", item: "Laptop", price: [28999, 159999], variants: ["8GB RAM 512GB SSD", "16GB RAM 512GB SSD", "16GB RAM 1TB SSD"], about: "A thin and light laptop built for work, study and long hours away from a charger.", colors: ["Silver", "Grey", "Black"] },
      { name: "Gaming Laptops", item: "Gaming Laptop", price: [59999, 219999], variants: ["RTX 4050", "RTX 4060", "RTX 4070"], about: "High refresh rate display and a dedicated graphics card for games and video editing.", colors: ["Black", "Grey"] },
      { name: "Monitors", item: "Monitor", price: [6999, 49999], variants: ["22 inch FHD", "24 inch IPS", "27 inch QHD"], about: "An eye-care monitor with thin bezels, ideal for a work-from-home desk.", colors: ["Black", "White"] },
      { name: "Keyboards & Mouse", item: "Keyboard Mouse Combo", price: [499, 7999], variants: ["Wired", "Wireless", "Mechanical"], about: "Comfortable typing with quiet keys and a mouse that tracks smoothly on any desk.", colors: ["Black", "White", "Grey"] },
      { name: "Printers", item: "Printer", price: [3999, 29999], variants: ["Ink Tank", "Laser", "All-in-One"], about: "Prints, scans and copies with low running cost for home and small office.", colors: ["Black", "White"] },
    ],
  },
  {
    name: "Electronics",
    children: [
      { name: "Headphones", item: "Headphones", price: [699, 24999], variants: ["Wireless", "Wired", "Noise Cancelling"], about: "Comfortable over-ear sound with deep bass and a microphone that people can actually hear." },
      { name: "Earbuds", item: "Earbuds", price: [799, 19999], variants: ["ANC", "ENC", "Gaming"], about: "True wireless earbuds with a pocket-size case and quick charge for the daily commute." },
      { name: "Speakers", item: "Bluetooth Speaker", price: [799, 24999], variants: ["10W", "20W", "40W"], about: "Portable speaker with punchy bass, water resistance and a full day of playback." },
      { name: "Smart Watches", item: "Smart Watch", price: [1299, 34999], variants: ["41mm", "45mm", "GPS", "LTE"], about: "Tracks steps, sleep and heart rate, and keeps notifications on your wrist instead of your pocket." },
      { name: "Televisions", item: "LED TV", price: [12999, 149999], variants: ["32 inch", "43 inch", "55 inch", "65 inch"], about: "A smart TV with sharp contrast and built-in apps, ready to use straight out of the box.", colors: ["Black"] },
      { name: "Cameras", item: "Camera", price: [9999, 159999], variants: ["Body Only", "With 18-55mm Lens", "Vlogging Kit"], about: "Mirrorless camera with fast autofocus and clean 4K video for creators.", colors: ["Black", "Silver"] },
    ],
  },
  {
    name: "Men's Fashion",
    children: [
      { name: "Men's T-Shirts", item: "T-Shirt", price: [349, 2499], variants: ["S", "M", "L", "XL", "XXL"], about: "Soft combed cotton that keeps its shape and colour after a full season of washing.", gender: "Men", ageGroup: "Adult" },
      { name: "Men's Shirts", item: "Shirt", price: [699, 4999], variants: ["S", "M", "L", "XL"], about: "A crisp everyday shirt for the office on weekdays and dinner on weekends.", gender: "Men", ageGroup: "Adult" },
      { name: "Men's Jeans", item: "Jeans", price: [899, 5999], variants: ["30", "32", "34", "36"], about: "Stretchable denim that holds its shape through long days of sitting, walking and travelling.", gender: "Men", ageGroup: "Adult" },
      { name: "Men's Trousers", item: "Trousers", price: [799, 4999], variants: ["30", "32", "34", "36"], about: "Wrinkle-resistant formal trousers with a comfortable waistband.", gender: "Men", ageGroup: "Adult" },
      { name: "Men's Jackets", item: "Jacket", price: [1299, 9999], variants: ["M", "L", "XL"], about: "A light jacket that blocks the wind and folds into a backpack.", gender: "Men", ageGroup: "Adult" },
      { name: "Men's Kurtas", item: "Men's Kurta", price: [599, 5999], variants: ["M", "L", "XL", "XXL"], about: "Festive cotton kurta with neat stitching for pujas, weddings and Eid.", gender: "Men", ageGroup: "Adult" },
      { name: "Men's Track Pants", item: "Track Pants", price: [499, 2999], variants: ["M", "L", "XL"], about: "Quick-dry track pants with zip pockets for the gym and morning walks.", gender: "Men", ageGroup: "Adult" },
    ],
  },
  {
    name: "Women's Fashion",
    children: [
      { name: "Women's Kurtas", item: "Kurta", price: [599, 6999], variants: ["S", "M", "L", "XL"], about: "A breathable kurta with clean stitching and a fit that stays comfortable all day.", gender: "Women", ageGroup: "Adult" },
      { name: "Sarees", item: "Saree", price: [999, 24999], variants: ["Banarasi", "Georgette", "Cotton Silk"], about: "A wedding-ready saree with a woven border and a matching unstitched blouse piece.", gender: "Women", ageGroup: "Adult" },
      { name: "Dresses", item: "Dress", price: [799, 7999], variants: ["S", "M", "L", "XL"], about: "A party dress with a flattering drape that needs no ironing after it comes out of the bag.", gender: "Women", ageGroup: "Adult" },
      { name: "Women's Tops", item: "Top", price: [399, 2999], variants: ["S", "M", "L", "XL"], about: "Easy everyday top that pairs with jeans, skirts and palazzos.", gender: "Women", ageGroup: "Adult" },
      { name: "Women's Jeans", item: "Women's Jeans", price: [899, 4999], variants: ["26", "28", "30", "32"], about: "High-rise stretch jeans that stay comfortable from morning to evening.", gender: "Women", ageGroup: "Adult" },
      { name: "Lehengas", item: "Lehenga", price: [2999, 39999], variants: ["Semi-Stitched", "Stitched"], about: "Embroidered lehenga with a matching dupatta, made for weddings and sangeet nights.", gender: "Women", ageGroup: "Adult" },
      { name: "Leggings", item: "Leggings", price: [249, 1499], variants: ["S", "M", "L", "XL"], about: "Four-way stretch leggings that do not fade or lose shape.", gender: "Women", ageGroup: "Adult" },
    ],
  },
  {
    name: "Kids & Baby",
    children: [
      { name: "Boys Clothing", item: "Boys T-Shirt", price: [249, 1999], variants: ["2-3 Years", "4-5 Years", "6-7 Years", "8-9 Years"], about: "Skin-friendly cotton with prints that survive playground afternoons and the washing machine.", gender: "Men", ageGroup: "Kids" },
      { name: "Girls Clothing", item: "Girls Frock", price: [299, 2999], variants: ["2-3 Years", "4-5 Years", "6-7 Years", "8-9 Years"], about: "Twirl-friendly frock in soft fabric with a comfortable inner lining.", gender: "Women", ageGroup: "Kids" },
      { name: "Baby Care", item: "Baby Care Kit", price: [199, 2999], variants: ["0-6 Months", "6-12 Months", "1-2 Years"], about: "Gentle, dermatologically tested care for a baby's delicate skin.", gender: "Unisex", ageGroup: "Kids", colors: [] },
      { name: "School Bags", item: "School Bag", price: [399, 2999], variants: ["Small", "Medium", "Large"], about: "Padded straps and three compartments to carry books, tiffin and a water bottle.", gender: "Unisex", ageGroup: "Kids" },
      { name: "Kids Footwear", item: "Kids Shoes", price: [349, 2999], variants: ["UK 10", "UK 11", "UK 12", "UK 1"], about: "Velcro shoes kids can wear on their own, with a sole that grips on school corridors.", gender: "Unisex", ageGroup: "Kids" },
    ],
  },
  {
    name: "Toys & Games",
    children: [
      { name: "Building Blocks", item: "Building Blocks", price: [199, 4999], variants: ["50 Pieces", "100 Pieces", "200 Pieces"], about: "Smooth-edged blocks that keep small hands busy and build creativity.", gender: "Unisex", ageGroup: "Kids" },
      { name: "Soft Toys", item: "Soft Toy", price: [199, 2999], variants: ["Small", "Medium", "Large"], about: "Huggable plush toy with child-safe stitching and fill.", gender: "Unisex", ageGroup: "Kids" },
      { name: "Remote Control Toys", item: "RC Car", price: [499, 6999], variants: ["1:24 Scale", "1:18 Scale", "Off-Road"], about: "Rechargeable remote control car with fast speed and sturdy tyres.", gender: "Unisex", ageGroup: "Kids" },
      { name: "Board Games", item: "Board Game", price: [299, 3499], variants: ["2-4 Players", "2-6 Players", "Family Pack"], about: "A family board game that brings everyone to the table for game night.", gender: "Unisex", colors: [] },
      { name: "Puzzles", item: "Jigsaw Puzzle", price: [199, 1999], variants: ["100 Pieces", "500 Pieces", "1000 Pieces"], about: "Thick, snug-fitting puzzle pieces with a bright printed picture.", gender: "Unisex", colors: [] },
      { name: "Dolls", item: "Doll", price: [299, 3999], variants: ["Classic", "Fashion Set", "With House"], about: "A doll set with outfits and accessories for hours of pretend play.", gender: "Women", ageGroup: "Kids" },
    ],
  },
  {
    name: "Footwear",
    children: [
      { name: "Men's Sports Shoes", item: "Running Shoes", price: [999, 12999], variants: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10"], about: "Cushioned running shoes with a breathable mesh upper and grip that holds on wet roads.", gender: "Men", ageGroup: "Adult" },
      { name: "Women's Sports Shoes", item: "Women's Running Shoes", price: [999, 10999], variants: ["UK 3", "UK 4", "UK 5", "UK 6", "UK 7"], about: "Lightweight trainers with a soft heel for walks, gym and yoga class.", gender: "Women", ageGroup: "Adult" },
      { name: "Formal Shoes", item: "Formal Shoes", price: [1299, 9999], variants: ["UK 6", "UK 7", "UK 8", "UK 9"], about: "Genuine leather formals with a soft footbed, made for long days on your feet.", gender: "Men", ageGroup: "Adult" },
      { name: "Women's Heels", item: "Heels", price: [699, 5999], variants: ["UK 3", "UK 4", "UK 5", "UK 6"], about: "Block heels with a padded insole that stay comfortable through a whole function.", gender: "Women", ageGroup: "Adult" },
      { name: "Sandals", item: "Sandals", price: [399, 3499], variants: ["UK 6", "UK 7", "UK 8", "UK 9"], about: "Lightweight everyday sandals with a non-slip sole and soft straps.", gender: "Unisex", ageGroup: "Adult" },
      { name: "Sneakers", item: "Sneakers", price: [899, 8999], variants: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10"], about: "Everyday sneakers that go with jeans, shorts and the walk to the metro station.", gender: "Unisex", ageGroup: "Adult" },
    ],
  },
  {
    name: "Bags & Accessories",
    children: [
      { name: "Backpacks", item: "Backpack", price: [499, 4999], variants: ["20L", "30L", "40L"], about: "Water-resistant backpack with a padded laptop sleeve and bottle pockets.", gender: "Unisex", ageGroup: "Adult" },
      { name: "Handbags", item: "Handbag", price: [599, 7999], variants: ["Tote", "Sling", "Clutch"], about: "Vegan leather handbag with roomy compartments and a sturdy zip.", gender: "Women", ageGroup: "Adult" },
      { name: "Wallets", item: "Wallet", price: [299, 2999], variants: ["Bi-Fold", "Tri-Fold", "Card Holder"], about: "Slim wallet with RFID protection and space for cards and cash.", gender: "Men", ageGroup: "Adult" },
      { name: "Watches", item: "Analog Watch", price: [699, 14999], variants: ["Leather Strap", "Metal Strap", "Silicone Strap"], about: "Classic analog watch with a scratch-resistant glass and water resistance.", gender: "Unisex", ageGroup: "Adult" },
      { name: "Sunglasses", item: "Sunglasses", price: [399, 5999], variants: ["Aviator", "Wayfarer", "Round"], about: "UV400 protected sunglasses with lightweight frames.", gender: "Unisex", ageGroup: "Adult" },
    ],
  },
  {
    name: "Home & Kitchen",
    children: [
      { name: "Cookware", item: "Cookware Set", price: [499, 12999], variants: ["2 Piece", "3 Piece", "5 Piece"], about: "Even-heating base that works on gas and induction, with handles that stay cool." },
      { name: "Storage", item: "Storage Box", price: [199, 3999], variants: ["Small", "Medium", "Large"], about: "Stackable airtight containers that keep the kitchen shelf tidy and snacks fresh." },
      { name: "Bedsheets", item: "Bedsheet", price: [399, 4999], variants: ["Single", "Double", "King"], about: "Soft cotton bedsheet with two pillow covers, pre-shrunk so the fit stays right." },
      { name: "Lighting", item: "LED Lamp", price: [249, 5999], variants: ["Warm White", "Cool White", "Smart"], about: "Flicker-free light that is easy on the eyes during late-night study or work." },
      { name: "Home Decor", item: "Wall Decor", price: [299, 6999], variants: ["Small", "Medium", "Large"], about: "Handcrafted decor piece that brings warmth to living rooms and bedrooms." },
      { name: "Furniture", item: "Study Table", price: [2999, 24999], variants: ["Compact", "Standard", "With Storage"], about: "Engineered wood furniture that is easy to assemble and built to last." },
    ],
  },
  {
    name: "Appliances",
    children: [
      { name: "Mixer Grinders", item: "Mixer Grinder", price: [1499, 8999], variants: ["500W", "750W", "1000W"], about: "Powerful motor with stainless steel jars for chutneys, masalas and batter.", colors: ["White", "Black", "Red"] },
      { name: "Refrigerators", item: "Refrigerator", price: [12999, 89999], variants: ["190L Single Door", "260L Double Door", "340L Frost Free"], about: "Energy-efficient refrigerator that keeps vegetables fresh for longer.", colors: ["Grey", "Silver", "Maroon"] },
      { name: "Washing Machines", item: "Washing Machine", price: [9999, 54999], variants: ["6kg Semi-Auto", "7kg Top Load", "8kg Front Load"], about: "Gentle wash programs that clean well while saving water and power.", colors: ["White", "Grey"] },
      { name: "Air Conditioners", item: "Split AC", price: [24999, 69999], variants: ["1 Ton", "1.5 Ton", "2 Ton"], about: "Inverter AC that cools fast and keeps electricity bills in control.", colors: ["White"] },
      { name: "Microwaves", item: "Microwave Oven", price: [4999, 24999], variants: ["20L Solo", "25L Grill", "28L Convection"], about: "Reheat, grill and bake with auto-cook menus for Indian dishes.", colors: ["Black", "Silver"] },
      { name: "Fans", item: "Ceiling Fan", price: [1199, 6999], variants: ["900mm", "1200mm", "BLDC 1200mm"], about: "High-speed fan with a powerful motor and dust-resistant finish.", colors: ["White", "Brown", "Grey"] },
    ],
  },
  {
    name: "Beauty & Personal Care",
    children: [
      { name: "Skincare", item: "Face Cream", price: [199, 3499], variants: ["50ml", "100ml", "200ml"], about: "Lightweight daily moisturiser that absorbs fast and does not leave a greasy film.", colors: [] },
      { name: "Haircare", item: "Hair Oil", price: [149, 2499], variants: ["100ml", "200ml", "400ml"], about: "Nourishing blend for dry scalp and frizz, with a light scent that fades quickly.", colors: [] },
      { name: "Fragrances", item: "Perfume", price: [399, 8999], variants: ["50ml", "100ml"], about: "Long-lasting fragrance with a fresh opening that settles into a warm base.", colors: [] },
      { name: "Makeup", item: "Lipstick", price: [199, 2499], variants: ["Matte", "Satin", "Liquid"], about: "Rich colour in one swipe that stays put through meals.", gender: "Women", ageGroup: "Adult", colors: ["Red", "Maroon", "Pink", "Brown"] },
      { name: "Men's Grooming", item: "Trimmer", price: [699, 4999], variants: ["Corded", "Cordless", "Multi-Grooming Kit"], about: "Skin-friendly blades and long battery life for a clean trim at home.", gender: "Men", ageGroup: "Adult", colors: ["Black", "Grey"] },
    ],
  },
  {
    name: "Sports & Fitness",
    children: [
      { name: "Fitness", item: "Dumbbell Set", price: [499, 14999], variants: ["5kg", "10kg", "20kg"], about: "Rubber-coated weights that protect the floor and stay quiet in a flat.", gender: "Unisex", ageGroup: "Adult" },
      { name: "Cricket", item: "Cricket Bat", price: [799, 19999], variants: ["Size 5", "Size 6", "Full Size"], about: "Kashmir willow bat with a thick edge and a grip that survives a full season.", gender: "Unisex" },
      { name: "Cycling", item: "Cycle", price: [4999, 49999], variants: ["26 inch", "27.5 inch", "29 inch"], about: "Steel frame cycle with dual disc brakes, built for city roads and weekend trails.", gender: "Unisex" },
      { name: "Yoga", item: "Yoga Mat", price: [299, 2999], variants: ["4mm", "6mm", "8mm"], about: "Anti-slip yoga mat with a cushioned surface for knees and back.", gender: "Unisex", ageGroup: "Adult" },
      { name: "Badminton", item: "Badminton Racket", price: [399, 7999], variants: ["Single", "Pair", "With Shuttles"], about: "Lightweight racket with a strong frame and comfortable grip.", gender: "Unisex" },
    ],
  },
  {
    name: "Books",
    children: [
      { name: "Fiction", item: "Novel", price: [149, 999], variants: ["Paperback", "Hardcover"], about: "A gripping story that is hard to put down once you start the first chapter.", colors: [] },
      { name: "Self Help", item: "Self Help Book", price: [149, 899], variants: ["Paperback", "Hardcover"], about: "Practical ideas to build better habits, focus and money sense.", colors: [] },
      { name: "Exam Preparation", item: "Exam Guide", price: [199, 1499], variants: ["Paperback", "Latest Edition"], about: "Chapter-wise practice and solved papers for competitive exams.", colors: [] },
      { name: "Children's Books", item: "Story Book", price: [99, 799], variants: ["Paperback", "Board Book"], about: "Colourful picture stories that make reading time fun for kids.", gender: "Unisex", ageGroup: "Kids", colors: [] },
    ],
  },
  {
    name: "Grocery & Gourmet",
    children: [
      { name: "Dry Fruits", item: "Dry Fruits", price: [249, 2999], variants: ["250g", "500g", "1kg"], about: "Handpicked premium dry fruits, packed fresh in a resealable pouch.", colors: [] },
      { name: "Tea & Coffee", item: "Tea", price: [149, 1499], variants: ["250g", "500g", "1kg"], about: "Strong and aromatic blend for the perfect morning cup.", colors: [] },
      { name: "Snacks", item: "Snack Pack", price: [49, 599], variants: ["Single", "Pack of 3", "Family Pack"], about: "Crunchy, tasty snacks for tea time and travel.", colors: [] },
      { name: "Spices", item: "Masala", price: [49, 699], variants: ["100g", "200g", "500g"], about: "Pure ground spices that bring home-style flavour to every dish.", colors: [] },
    ],
  },
];

// Brand ke naam banaye hue hain — asli trademark portfolio project me nahi daalte.
const BRANDS = [
  "Voltro", "Nexora", "Urbanite", "Kestrel", "Maruvi", "Zentra", "Auralis", "Nordfell",
  "Trikon", "Bluewick", "Sahara Mills", "Ironpeak", "Lumora", "Cascade", "Vireo",
  "Rasika", "Tanvi", "Orbell", "Stonefield", "Glimr", "Panther Lab", "Kavach",
  "Moonbay", "Everloom", "Silverline", "Desi Roots", "Pixelon", "Kaveri Craft",
  "Monsoon Tales", "Swadesh Foods", "Lotus Living", "Rangrez", "Chhota Bheem Toys",
] as const;

// DB me colour Title Case me rehta hai — catalog ka filter isi par chalta hai.
const COLORS = [
  "Black", "White", "Navy Blue", "Red", "Grey", "Beige", "Olive Green",
  "Maroon", "Mustard", "Sky Blue", "Pink", "Brown", "Silver", "Purple", "Yellow",
] as const;

const MODELS = [
  "Nova", "Pulse", "Aero", "Prime", "Edge", "Flux", "Astra", "Vertex", "Drift",
  "Crest", "Onyx", "Halo", "Terra", "Swift", "Lumen", "Arc", "Zen", "Bolt",
] as const;

const FIRST_NAMES = [
  "Ankit", "Priya", "Rahul", "Sneha", "Vikas", "Anjali", "Rohit", "Pooja", "Amit",
  "Neha", "Sandeep", "Kavita", "Manish", "Divya", "Arjun", "Meera", "Suresh",
  "Ritu", "Naveen", "Shreya",
] as const;

const LAST_NAMES = [
  "Pandey", "Sharma", "Verma", "Gupta", "Singh", "Yadav", "Mishra", "Joshi",
  "Nair", "Reddy", "Patel", "Das",
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

const TOTAL_PRODUCTS = 8000;
const TOTAL_USERS = 300;
const TOTAL_ORDERS = 4000;
const BATCH = 1000;
// Wahi number jo .env me hai — login par auth.service bhi isi ko super admin banati hai.
const SUPER_ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE ?? "9876543210";

// ---------------------------------------------------------------------------
// Purana data hatao — seed dobara chalane par duplicate na banein.
// Kram FK ke hisaab se hai: pehle bachche, phir maa-baap.
// ---------------------------------------------------------------------------
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

// Bade list ko 1000-1000 ke tukdon me daalo — ek saath 1500 row bhejne par
// query bahut lambi ho jaati hai.
async function insertInBatches<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await insert(rows.slice(i, i + BATCH));
  }
}

async function main() {
  console.log("Purana data hata rahe hain...");
  await clearAll();

  // ---------------- Category + Subcategory ----------------
  const parentRows = [];
  const childRows = [];
  // Product banate waqt kaam aayega: har subcategory ka id + uska dhancha.
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

  // ---------------- Brand ----------------
  const brandRows = BRANDS.map((name) => ({
    id: randomUUID(),
    name,
    slug: slugify(name),
    logo: imageUrl(slugify(name), 0),
  }));
  await prisma.brand.createMany({ data: brandRows });
  console.log(`Brand: ${brandRows.length}`);

  // ---------------- Product ----------------
  // Har subcategory me barabar products, bacha hua pehli subcategory me.
  const perCategory = Math.floor(TOTAL_PRODUCTS / subCategories.length);
  const usedSlugs = new Set<string>();
  const products = [];

  for (let c = 0; c < subCategories.length; c++) {
    const { id: categoryId, child } = subCategories[c];
    const count = c === 0 ? perCategory + (TOTAL_PRODUCTS % subCategories.length) : perCategory;

    for (let i = 0; i < count; i++) {
      const brand = pick(brandRows);
      const model = pick(MODELS);
      const variant = pick(child.variants);
      const colorChoices = child.colors ?? COLORS;
      const color = colorChoices.length > 0 ? pick(colorChoices) : null;
      const series = between(2, 9);

      const name = `${brand.name} ${model} ${series} ${child.item} ${variant}`;
      let slug = slugify(name);
      // Naam kabhi-kabhi repeat ho jaata hai — slug unique hona zaroori hai.
      if (usedSlugs.has(slug)) slug = `${slug}-${products.length}`;
      usedSlugs.add(slug);

      const rupees = between(child.price[0], child.price[1]);
      // ...99 par khatam hone wale daam asli lagte hain.
      const pricePaise = (Math.floor(rupees / 100) * 100 + 99) * 100;

      // 45% products par discount. Unme se kuch par deadline bhi.
      const discountPercent = chance(45) ? between(5, 60) : 0;
      const offerEndsAt = discountPercent > 0 && chance(35) ? daysFromNow(between(2, 45)) : null;
      const sellPaise = finalPrice(pricePaise, discountPercent);

      // Teeno stock status dikhen: out of stock, kam bacha, aur normal.
      const stock = chance(6) ? 0 : chance(12) ? between(1, 5) : between(10, 250);

      products.push({
        id: randomUUID(),
        name,
        slug,
        description: [
          child.about,
          `Variant: ${variant}.`,
          color ? `Colour: ${color}.` : "",
          `Brand: ${brand.name}. Ships in 2-5 days with easy returns on damaged items.`,
        ]
          .filter(Boolean)
          .join(" "),
        pricePaise,
        discountPercent,
        sellPaise,
        offerEndsAt,
        stock,
        color,
        gender: child.gender ?? null,
        ageGroup: child.ageGroup ?? null,
        images: [imageUrl(slug, 1), imageUrl(slug, 2), imageUrl(slug, 3)],
        categoryId,
        brandId: brand.id,
        isActive: !chance(3), // kuch products chhupe hue, taki admin ka hide/unhide dikhe
        isTrending: chance(8),
        isFeatured: chance(8),
        ratingSum: 0,
        ratingCount: 0,
        ratingAverage: 0,
      });
    }
  }

  // ---------------- User + Address ----------------
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

  // ---------------- Order + OrderItem ----------------
  // Har status ka order banao, taki admin panel aur "my orders" dono bharey dikhen.
  const orders = [];
  const orderItems = [];
  // Review sirf DELIVERED order wale customer de sakta hai — wahi jodi yahan yaad rakhte hain.
  const deliveredPairs: { userId: string; productId: string }[] = [];
  const liveProducts = products.filter((p) => p.isActive);
  // Har store me kuch products zyada bikte hain. Isi wajah se unpar reviews bhi zyada
  // aati hain aur baaki par kam — bilkul waise jaise asli catalog me hota hai.
  const popular = liveProducts.slice(0, 400);

  for (let i = 0; i < TOTAL_ORDERS; i++) {
    const user = pick(users);
    const userAddresses = addresses.filter((a) => a.userId === user.id);
    const address = pick(userAddresses);

    const paymentMethod = chance(55) ? ("ONLINE" as const) : ("COD" as const);
    const picked = pick(["DELIVERED", "DELIVERED", "DELIVERED", "SHIPPED", "CONFIRMED", "PENDING", "CANCELLED"] as const);
    // COD order bante hi CONFIRMED hota hai — PENDING sirf unpaid online order.
    const status = paymentMethod === "COD" && picked === "PENDING" ? "CONFIRMED" : picked;

    // COD par paisa delivery pe milta hai; online par pay hone ke baad hi COMPLETED.
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
      // PENDING order ka stock ruka hua hai — deadline par releaseExpiredOrders() use wapas jodega.
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
      paymentExpiresAt:
        paymentMethod === "ONLINE" && status === "PENDING" ? daysFromNow(0.02) : null,
      razorpayOrderId: paymentMethod === "ONLINE" ? `order_seed${i}${orderId.slice(0, 6)}` : null,
      razorpayPaymentId: paymentMethod === "ONLINE" && paymentStatus === "COMPLETED" ? `pay_seed${i}` : null,
      createdAt,
      updatedAt: createdAt,
    });
  }

  // ---------------- Review ----------------
  // Sirf delivered wali jodi se, aur ek user ek product par ek hi baar.
  const reviews = [];
  const reviewed = new Set<string>();
  const ratingByProduct = new Map<string, { sum: number; count: number }>();

  for (const pair of deliveredPairs) {
    const key = `${pair.productId}:${pair.userId}`;
    if (reviewed.has(key)) continue;
    // Har khareedar review nahi likhta.
    if (!chance(65)) continue;
    reviewed.add(key);

    // Zyadatar log 4-5 dete hain, kuch kam.
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

  // Rating product row par likhi jaati hai (har card par AVG() na chale).
  // Isliye product insert karne se PEHLE asli reviews se ginti bhar dete hain.
  for (const product of products) {
    const found = ratingByProduct.get(product.id);
    if (!found) continue;
    product.ratingSum = found.sum;
    product.ratingCount = found.count;
    product.ratingAverage = found.sum / found.count;
  }

  // ---------------- Banner ----------------
  const banners = [
    { text: "Festive Sale", link: "/products?discount=true" },
    { text: "New Arrivals", link: "/products?sort=latest" },
    { text: "Trending Now", link: "/products?section=trending" },
    { text: "Electronics Deals", link: "/products?category=electronics" },
    { text: "Fashion Under 999", link: "/products?category=womens-fashion&maxPrice=999" },
    { text: "Kids Corner", link: "/products?category=kids-baby" },
  ].map((banner, i) => ({
    id: randomUUID(),
    image: imageUrl(slugify(banner.text), 0),
    link: banner.link,
    position: i,
    isActive: true,
  }));

  // ---------------- Sab DB me daalo ----------------
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
