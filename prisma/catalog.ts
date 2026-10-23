type Discount = [chance: number, min: number, max: number];

type Child = { name: string; about: string; sizes?: string[]; gender?: string; ageGroup?: string };

type Parent = { name: string; discount: Discount; children: Child[] };

type Model = {
  category: string;
  brand: string;
  name: string;
  price: number;
  colors: string[];
  specs: Record<string, string>;
};

type Line = {
  category: string;
  prefix: string;
  share: number;
  items: string;
  styles: string;
  brands: string;
  colors: string;
  specs: string;
  itemSpecs?: Record<string, string>;
};

type CatalogProduct = Model & {
  sizes: string[];
  gender: string | null;
  ageGroup: string | null;
  description: string;
  discount: Discount;
};

const TOP_SIZES = ["S", "M", "L", "XL", "XXL"];
const WOMEN_SIZES = ["XS", "S", "M", "L", "XL"];
const KID_SIZES = ["2-3 Years", "4-5 Years", "6-7 Years", "8-9 Years", "10-11 Years", "12-13 Years"];
const MEN_SHOE_SIZES = ["6", "7", "8", "9", "10", "11"];
const WOMEN_SHOE_SIZES = ["3", "4", "5", "6", "7", "8"];

const MEN = { gender: "Men", ageGroup: "Adult" };
const WOMEN = { gender: "Women", ageGroup: "Adult" };

export const CATEGORIES: Parent[] = [
  {
    name: "Mobiles & Tablets",
    discount: [30, 3, 12],
    children: [
      {
        name: "Smartphones",
        about:
          "A smartphone with a bright display, a big battery that lasts the whole day, a sharp camera for photos and video calls, fast charging and smooth gaming.",
      },
      {
        name: "Tablets",
        about: "A tablet for online classes, movies, note taking and video calls, with a long-lasting battery.",
      },
      {
        name: "Power Banks",
        about:
          "Keeps your phone charged through long travel days and tours, with fast charging and a compact, light body.",
      },
    ],
  },
  {
    name: "Laptops",
    discount: [40, 5, 15],
    children: [
      {
        name: "Everyday Laptops",
        about:
          "A thin and light laptop for office work, college, coding and online classes, with a battery that lasts the day.",
      },
      {
        name: "Gaming Laptops",
        about:
          "Built for gaming and video editing, with a high refresh rate display, a dedicated graphics card and strong cooling.",
      },
    ],
  },
  {
    name: "Audio & Wearables",
    discount: [40, 5, 15],
    children: [
      {
        name: "Headphones",
        about: "Clear sound with deep bass and a comfortable fit for music, calls, gaming and the gym.",
      },
      {
        name: "Smart Watches",
        about: "Tracks steps, heart rate, sleep and gym workouts, shows notifications and helps you stay active.",
      },
    ],
  },
  {
    name: "Men's Fashion",
    discount: [80, 20, 65],
    children: [
      {
        name: "Men's T-Shirts",
        about: "Soft, breathable fabric that keeps its shape and colour, good for daily wear, college and the gym.",
        sizes: TOP_SIZES,
        ...MEN,
      },
      {
        name: "Men's Shirts",
        about: "A crisp shirt for the office on weekdays and parties on weekends.",
        sizes: TOP_SIZES,
        ...MEN,
      },
      {
        name: "Men's Jeans",
        about: "Comfortable denim that holds its shape through college days, outings and parties.",
        sizes: ["28", "30", "32", "34", "36", "38"],
        ...MEN,
      },
      {
        name: "Men's Trousers",
        about: "Comfortable trousers with a clean fit for the office and weekends.",
        sizes: ["28", "30", "32", "34", "36", "38"],
        ...MEN,
      },
      {
        name: "Men's Kurtas",
        about: "Ethnic wear with neat stitching for weddings, festivals, pujas and family functions.",
        sizes: TOP_SIZES,
        ...MEN,
      },
      {
        name: "Men's Shoes",
        about: "Cushioned, durable shoes for walking, running, the gym, office and everyday wear.",
        sizes: MEN_SHOE_SIZES,
        ...MEN,
      },
      {
        name: "Men's Slippers",
        about: "Light, washable footwear with a soft footbed for home, bathroom and short walks.",
        sizes: MEN_SHOE_SIZES,
        ...MEN,
      },
    ],
  },
  {
    name: "Women's Fashion",
    discount: [80, 20, 65],
    children: [
      {
        name: "Women's Kurtas",
        about: "A breathable kurta with clean stitching for office, festivals and weddings.",
        sizes: ["XS", ...TOP_SIZES],
        ...WOMEN,
      },
      {
        name: "Sarees",
        about: "Graceful drape with a matching blouse piece for weddings, festivals and pujas.",
        ...WOMEN,
      },
      {
        name: "Lehenga Cholis",
        about: "A rich lehenga with a matching choli and dupatta for weddings, sangeet and festivals.",
        sizes: ["S", "M", "L", "XL"],
        ...WOMEN,
      },
      {
        name: "Dresses",
        about: "A dress with a flattering fit for parties, birthdays, dates and evening outings.",
        sizes: WOMEN_SIZES,
        ...WOMEN,
      },
      {
        name: "Women's Tops",
        about: "Easy everyday top for college, office and parties that pairs with jeans, skirts and palazzos.",
        sizes: WOMEN_SIZES,
        ...WOMEN,
      },
      {
        name: "Women's Jeans",
        about: "Stretch jeans that stay comfortable from college mornings to evening parties.",
        sizes: ["26", "28", "30", "32", "34"],
        ...WOMEN,
      },
      {
        name: "Women's Sandals",
        about: "Comfortable footwear with a soft footbed for daily wear, parties and outings.",
        sizes: WOMEN_SHOE_SIZES,
        ...WOMEN,
      },
      {
        name: "Women's Shoes",
        about: "Light shoes with a cushioned sole for walks, the gym and long days out.",
        sizes: WOMEN_SHOE_SIZES,
        ...WOMEN,
      },
    ],
  },
  {
    name: "Kids Fashion",
    discount: [70, 15, 55],
    children: [
      {
        name: "Boys Clothing",
        about: "Skin-friendly clothes for school, play, birthday parties and festivals.",
        sizes: KID_SIZES,
        gender: "Men",
        ageGroup: "Kids",
      },
      {
        name: "Girls Clothing",
        about: "Soft, comfortable clothes for school, play, birthday parties and festivals.",
        sizes: KID_SIZES,
        gender: "Women",
        ageGroup: "Kids",
      },
    ],
  },
  {
    name: "Beauty",
    discount: [50, 5, 30],
    children: [
      {
        name: "Lipsticks",
        about: "Rich colour in one swipe that stays on through parties, weddings and long office days.",
        ...WOMEN,
      },
      { name: "Eye Makeup", about: "Smooth, smudge-proof colour that stays sharp for hours.", ...WOMEN },
      { name: "Skin Care", about: "Gentle daily care made for Indian weather, free from harsh chemicals." },
    ],
  },
  {
    name: "Grocery",
    discount: [40, 3, 15],
    children: [
      { name: "Staples", about: "Clean, sorted and packed fresh for everyday cooking at home." },
      { name: "Oils & Ghee", about: "Pure cooking oil and ghee in a leak-proof pack for daily tadka and frying." },
      { name: "Tea & Coffee", about: "Fresh, aromatic blends for the morning cup and evening chai." },
      { name: "Snacks", about: "Crunchy snacks in a fresh, resealable pack for tea time, guests and parties." },
    ],
  },
  {
    name: "Bags & Travel",
    discount: [40, 5, 20],
    children: [
      {
        name: "Trolley Bags",
        about: "Hard-shell trolley with smooth spinner wheels and a number lock, made for travel, tours and flights.",
      },
      {
        name: "Backpacks",
        about:
          "Water-resistant bag with padded straps and a laptop sleeve, for school, college, office, trekking and travel.",
      },
      {
        name: "Travel Accessories",
        about: "Handy travel accessories that make long journeys, flights and tours easier and more comfortable.",
      },
    ],
  },
  {
    name: "Home & Kitchen",
    discount: [50, 5, 35],
    children: [
      {
        name: "Lighting",
        about: "Bright, energy-saving light for home, office and study, and for Diwali and festival decoration.",
      },
      {
        name: "Kitchen",
        about:
          "Strong, easy-to-clean kitchenware for daily cooking at home, with bottles and lunch boxes for school, college and office.",
      },
    ],
  },
  {
    name: "Baby Care",
    discount: [40, 5, 20],
    children: [
      {
        name: "Diapers",
        about:
          "Soft diaper pants with leak protection and a rash-free top layer for newborns and toddlers, day and night.",
        sizes: ["NB", "S", "M", "L", "XL", "XXL"],
        ageGroup: "Kids",
      },
      {
        name: "Baby Wipes",
        about: "Gentle wipes for diaper changes, meals and outings, safe for newborn skin.",
        ageGroup: "Kids",
      },
    ],
  },
];

// "a, b, c" -> ["a", "b", "c"].
function list(text: string) {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

// A table written as "cell | cell | cell" lines -> rows of cells.
function rows(table: string) {
  return table
    .trim()
    .split("\n")
    .map((line) => line.split("|").map((cell) => cell.trim()));
}

// "Kurta 899, Saree 1499" -> [["Kurta", 899], ["Saree", 1499]].
function pairs(text: string): [string, number][] {
  return list(text).map((part) => [
    part.slice(0, part.lastIndexOf(" ")),
    Number(part.slice(part.lastIndexOf(" ") + 1)),
  ]);
}

// "RAM: 8GB; Storage: 128GB" -> { RAM: "8GB", Storage: "128GB" }.
function specsOf(text: string): Record<string, string> {
  return Object.fromEntries(
    text
      .split(";")
      .filter((part) => part.includes(":"))
      .map((part) => [part.slice(0, part.indexOf(":")).trim(), part.slice(part.indexOf(":") + 1).trim()]),
  );
}

// A shop-style price: 1234 -> 1299, 456 -> 459.
function priceOf(rupees: number) {
  if (rupees < 1000) return Math.max(99, Math.round(rupees / 10) * 10 - 1);
  return Math.floor(rupees / 100) * 100 + 99;
}

// Phones and tablets: one product per RAM/storage variant.
function phones(category: string, table: string): Model[] {
  return rows(table).flatMap(([brand, model, colors, display, camera, battery, chip, variants]) =>
    list(variants).map((variant) => {
      const [memory, price] = variant.split("=");
      const [ram, storage] = memory.includes("/") ? memory.split("/") : ["", memory];
      return {
        category,
        brand,
        name: `${brand} ${model} (${ram ? `${ram} RAM, ` : ""}${storage})`,
        price: Number(price),
        colors: list(colors),
        specs: {
          Display: `${display} inch`,
          Camera: `${camera}MP`,
          Battery: `${battery}mAh`,
          Processor: chip,
          ...(ram && { RAM: ram }),
          Storage: storage,
        },
      };
    }),
  );
}

// Laptops: one product per RAM/SSD configuration.
function laptops(category: string, table: string): Model[] {
  return rows(table).flatMap(([brand, model, colors, chip, graphics, display, configs]) =>
    list(configs).map((config) => {
      const [memory, price] = config.split("=");
      const [ram, storage] = memory.split("/");
      return {
        category,
        brand,
        name: `${brand} ${model} (${chip}, ${graphics}, ${ram} RAM, ${storage} SSD, ${display} inch)`,
        price: Number(price),
        colors: list(colors),
        specs: { Processor: chip, Graphics: graphics, Display: `${display} inch`, RAM: ram, Storage: `${storage} SSD` },
      };
    }),
  );
}

// Other real products (audio, beauty, grocery, bags…): one product per size or pack variant.
function goods(category: string, table: string): Model[] {
  return rows(table).flatMap(([brand, name, colors, specs, variants]) => {
    const key = variants.includes(":") ? variants.slice(0, variants.indexOf(":")).trim() : "";
    return list(variants.slice(variants.indexOf(":") + 1)).map((variant) => {
      const [label, price] = variant.includes("=") ? variant.split("=") : ["", variant];
      return {
        category,
        brand,
        name: [brand, name, label].filter(Boolean).join(" "),
        price: Number(price),
        colors: list(colors),
        specs: { ...specsOf(specs), ...(label && { [key]: label }) },
      };
    });
  });
}

const PHONES = `
Samsung | Galaxy S24 Ultra 5G | Titanium Black, Titanium Gray, Titanium Violet, Titanium Yellow | 6.8 | 200 | 5000 | Snapdragon 8 Gen 3 | 12GB/256GB=129999, 12GB/512GB=139999
Samsung | Galaxy S24 5G | Onyx Black, Marble Grey, Cobalt Violet, Amber Yellow | 6.2 | 50 | 4000 | Exynos 2400 | 8GB/256GB=79999, 8GB/512GB=89999
Samsung | Galaxy S24 FE 5G | Blue, Graphite, Mint | 6.7 | 50 | 4700 | Exynos 2400e | 8GB/128GB=59999, 8GB/256GB=65999
Samsung | Galaxy Z Fold6 5G | Silver Shadow, Pink, Navy | 7.6 | 50 | 4400 | Snapdragon 8 Gen 3 | 12GB/256GB=164999, 12GB/512GB=176999
Samsung | Galaxy Z Flip6 5G | Silver Shadow, Yellow, Blue, Mint | 6.7 | 50 | 4000 | Snapdragon 8 Gen 3 | 12GB/256GB=109999, 12GB/512GB=121999
Samsung | Galaxy A55 5G | Ice Blue, Lilac, Navy | 6.6 | 50 | 5000 | Exynos 1480 | 8GB/128GB=39999, 8GB/256GB=42999
Samsung | Galaxy A35 5G | Ice Blue, Lilac, Navy | 6.6 | 50 | 5000 | Exynos 1380 | 8GB/128GB=30999, 8GB/256GB=33999
Samsung | Galaxy M55 5G | Denim Black, Light Green | 6.7 | 50 | 5000 | Snapdragon 7 Gen 1 | 8GB/128GB=26999, 8GB/256GB=29999, 12GB/256GB=32999
Samsung | Galaxy M35 5G | Moonlight Blue, Daybreak Blue, Thunder Grey | 6.6 | 50 | 6000 | Exynos 1380 | 6GB/128GB=19999, 8GB/128GB=21499, 8GB/256GB=24299
Samsung | Galaxy A15 5G | Blue Black, Light Blue, Blue | 6.5 | 50 | 5000 | Dimensity 6100+ | 8GB/128GB=19499, 8GB/256GB=22499
Samsung | Galaxy M15 5G | Blue Topaz, Celestial Blue, Stone Grey | 6.5 | 50 | 6000 | Dimensity 6100+ | 4GB/128GB=13299, 6GB/128GB=14799
Samsung | Galaxy F15 5G | Ash Black, Groovy Violet, Jazzy Green | 6.5 | 50 | 6000 | Dimensity 6100+ | 4GB/128GB=12999, 6GB/128GB=14499
Samsung | Galaxy A06 | Black, Gold, Light Blue | 6.7 | 50 | 5000 | Helio G85 | 4GB/64GB=9999, 4GB/128GB=11499
Apple | iPhone 16 Pro Max | Desert Titanium, Natural Titanium, White Titanium, Black Titanium | 6.9 | 48 | 4685 | A18 Pro | 256GB=144900, 512GB=164900, 1TB=184900
Apple | iPhone 16 Pro | Desert Titanium, Natural Titanium, White Titanium, Black Titanium | 6.3 | 48 | 3582 | A18 Pro | 128GB=119900, 256GB=129900, 512GB=149900
Apple | iPhone 16 Plus | Black, White, Pink, Teal, Ultramarine | 6.7 | 48 | 4674 | A18 | 128GB=89900, 256GB=99900
Apple | iPhone 16 | Black, White, Pink, Teal, Ultramarine | 6.1 | 48 | 3561 | A18 | 128GB=79900, 256GB=89900, 512GB=109900
Apple | iPhone 16e | Black, White | 6.1 | 48 | 4005 | A18 | 128GB=59900, 256GB=69900
Apple | iPhone 15 | Black, Blue, Green, Yellow, Pink | 6.1 | 48 | 3349 | A16 Bionic | 128GB=69900, 256GB=79900
Apple | iPhone 15 Plus | Black, Blue, Green, Yellow, Pink | 6.7 | 48 | 4383 | A16 Bionic | 128GB=79900
Apple | iPhone 14 | Midnight, Starlight, Blue, Purple, Red | 6.1 | 12 | 3279 | A15 Bionic | 128GB=59900
Apple | iPhone 13 | Midnight, Starlight, Blue, Pink, Green | 6.1 | 12 | 3227 | A15 Bionic | 128GB=49900
Google | Pixel 9 Pro XL | Obsidian, Porcelain, Hazel, Rose Quartz | 6.8 | 50 | 5060 | Tensor G4 | 16GB/256GB=124999
Google | Pixel 9 Pro | Obsidian, Porcelain, Hazel, Rose Quartz | 6.3 | 50 | 4700 | Tensor G4 | 16GB/256GB=109999
Google | Pixel 9 | Obsidian, Porcelain, Wintergreen, Peony | 6.3 | 50 | 4700 | Tensor G4 | 12GB/256GB=79999
Google | Pixel 9a | Obsidian, Porcelain, Iris | 6.3 | 48 | 5100 | Tensor G4 | 8GB/256GB=49999
Google | Pixel 8a | Obsidian, Porcelain, Bay, Aloe | 6.1 | 64 | 4492 | Tensor G3 | 8GB/128GB=52999, 8GB/256GB=59999
OnePlus | 13 | Black Eclipse, Midnight Ocean, Arctic Dawn | 6.82 | 50 | 6000 | Snapdragon 8 Elite | 12GB/256GB=69999, 16GB/512GB=76999, 24GB/1TB=89999
OnePlus | 13R | Nebula Noir, Astral Trail | 6.78 | 50 | 6000 | Snapdragon 8 Gen 3 | 12GB/256GB=42999, 16GB/512GB=49999
OnePlus | 12 | Silky Black, Flowy Emerald | 6.82 | 50 | 5400 | Snapdragon 8 Gen 3 | 12GB/256GB=64999, 16GB/512GB=69999
OnePlus | 12R | Iron Gray, Cool Blue | 6.78 | 50 | 5500 | Snapdragon 8 Gen 2 | 8GB/128GB=39999, 16GB/256GB=45999
OnePlus | Nord 4 5G | Mercurial Silver, Oasis Green, Obsidian Midnight | 6.74 | 50 | 5500 | Snapdragon 7+ Gen 3 | 8GB/128GB=29999, 8GB/256GB=32999, 12GB/256GB=35999
OnePlus | Nord CE4 5G | Dark Chrome, Celadon Marble | 6.7 | 50 | 5500 | Snapdragon 7 Gen 3 | 8GB/128GB=24999, 8GB/256GB=26999
OnePlus | Nord CE4 Lite 5G | Super Silver, Mega Blue, Ultra Orange | 6.67 | 50 | 5500 | Snapdragon 695 | 8GB/128GB=19999, 8GB/256GB=22999
Xiaomi | 14 | Black, White, Jade Green | 6.36 | 50 | 4610 | Snapdragon 8 Gen 3 | 12GB/512GB=69999
Xiaomi | 14 Civi | Cruise Blue, Matcha Green, Shadow Black | 6.55 | 50 | 4700 | Snapdragon 8s Gen 3 | 8GB/256GB=42999, 12GB/512GB=47999
Redmi | Note 14 Pro+ 5G | Titan Black, Spectre Blue, Phantom Purple | 6.67 | 50 | 6200 | Snapdragon 7s Gen 3 | 8GB/128GB=29999, 8GB/256GB=31999, 12GB/512GB=34999
Redmi | Note 14 Pro 5G | Titan Black, Spectre Blue, Phantom Purple | 6.67 | 50 | 5500 | Dimensity 7300 Ultra | 8GB/128GB=23999, 8GB/256GB=25999
Redmi | Note 14 5G | Titan Black, Mystique White, Phantom Purple | 6.67 | 50 | 5110 | Dimensity 7025 Ultra | 6GB/128GB=17999, 8GB/128GB=18999, 8GB/256GB=20999
Redmi | 14C 5G | Starlight Blue, Stardust Purple, Stargaze Black | 6.88 | 50 | 5160 | Snapdragon 4 Gen 2 | 4GB/64GB=9999, 4GB/128GB=10999, 6GB/128GB=11999
Redmi | 13 5G | Black Diamond, Hawaiian Blue, Orchid Pink | 6.79 | 108 | 5030 | Snapdragon 4 Gen 2 | 6GB/128GB=13999, 8GB/128GB=15499
Redmi | A4 5G | Starry Black, Sparkle Purple | 6.88 | 50 | 5160 | Snapdragon 4s Gen 2 | 4GB/64GB=8499, 4GB/128GB=9499
Poco | X7 Pro 5G | Obsidian Black, Nebula Green, Poco Yellow | 6.67 | 50 | 6550 | Dimensity 8400 Ultra | 8GB/256GB=27999, 12GB/256GB=29999
Poco | X6 Pro 5G | Racing Grey, Spectre Black, Poco Yellow | 6.67 | 64 | 5000 | Dimensity 8300 Ultra | 8GB/256GB=23999, 12GB/512GB=26999
Poco | F6 5G | Titanium, Black | 6.67 | 50 | 5000 | Snapdragon 8s Gen 3 | 8GB/256GB=29999, 12GB/256GB=31999, 12GB/512GB=33999
Poco | M6 Plus 5G | Misty Lavender, Ice Silver, Graphite Black | 6.79 | 108 | 5030 | Snapdragon 4 Gen 2 | 6GB/128GB=13499, 8GB/128GB=14499
Poco | C75 5G | Aqua Bliss, Silver Stardust, Enchanted Green | 6.88 | 50 | 5160 | Snapdragon 4s Gen 2 | 4GB/64GB=7999
Realme | GT 7 Pro | Galaxy Grey, Mars Orange | 6.78 | 50 | 5800 | Snapdragon 8 Elite | 12GB/256GB=59999, 16GB/512GB=65999
Realme | GT 6 | Fluid Silver, Razor Green | 6.78 | 50 | 5500 | Snapdragon 8s Gen 3 | 8GB/256GB=40999, 12GB/256GB=42999, 16GB/512GB=44999
Realme | 14 Pro+ 5G | Pearl White, Suede Grey, Bikaner Purple | 6.83 | 50 | 6000 | Snapdragon 7s Gen 3 | 8GB/128GB=29999, 8GB/256GB=31999, 12GB/256GB=34999
Realme | 13 Pro+ 5G | Emerald Green, Monet Gold, Monet Purple | 6.7 | 50 | 5200 | Snapdragon 7s Gen 2 | 8GB/256GB=32999, 12GB/256GB=34999, 12GB/512GB=36999
Realme | 13 Pro 5G | Emerald Green, Monet Gold, Monet Purple | 6.7 | 50 | 5200 | Snapdragon 7s Gen 2 | 8GB/128GB=26999, 8GB/256GB=28999
Realme | 13 5G | Speed Green, Dark Purple | 6.72 | 50 | 5000 | Dimensity 6300 | 8GB/128GB=17999, 8GB/256GB=19999
Realme | Narzo 70 Pro 5G | Glass Green, Glass Gold | 6.67 | 50 | 5000 | Dimensity 7050 | 8GB/128GB=19999, 8GB/256GB=21999
Realme | Narzo 70x 5G | Ice Blue, Forest Green | 6.72 | 50 | 5000 | Dimensity 6100+ | 4GB/128GB=11999, 6GB/128GB=13499
Realme | P1 5G | Peacock Green, Phoenix Red | 6.67 | 50 | 5000 | Dimensity 7050 | 6GB/128GB=15999, 8GB/256GB=18999
Realme | C65 5G | Glowing Black, Feather Green, Speedy Red | 6.67 | 50 | 5000 | Dimensity 6300 | 4GB/64GB=10499, 4GB/128GB=11499, 6GB/128GB=12499
Vivo | X200 Pro | Cosmos Black, Titanium Grey | 6.78 | 50 | 6000 | Dimensity 9400 | 16GB/512GB=94999
Vivo | X200 | Cosmos Black, Natural Green | 6.67 | 50 | 5800 | Dimensity 9400 | 12GB/256GB=65999, 16GB/512GB=71999
Vivo | V40 Pro 5G | Ganges Blue, Titanium Grey | 6.78 | 50 | 5500 | Dimensity 9200+ | 8GB/256GB=49999, 12GB/512GB=55999
Vivo | V40 5G | Ganges Blue, Titanium Grey, Lotus Purple | 6.78 | 50 | 5500 | Snapdragon 7 Gen 3 | 8GB/128GB=34999, 8GB/256GB=36999, 12GB/512GB=41999
Vivo | T3 Ultra 5G | Frost Green, Lunar Gray | 6.78 | 50 | 5500 | Dimensity 9200+ | 8GB/128GB=31999, 8GB/256GB=33999, 12GB/256GB=35999
Vivo | T3 5G | Cosmic Blue, Crystal Flake | 6.67 | 50 | 5000 | Dimensity 7200 | 8GB/128GB=19999, 8GB/256GB=21999
Vivo | Y58 5G | Sundarbans Green, Himalayan Blue | 6.72 | 50 | 6000 | Snapdragon 4 Gen 2 | 8GB/128GB=19499
Vivo | Y28s 5G | Twinkling Purple, Vintage Red | 6.56 | 50 | 5000 | Dimensity 6300 | 4GB/128GB=13999, 6GB/128GB=15499, 8GB/128GB=16999
iQOO | 13 5G | Legend, Nardo Grey | 6.82 | 50 | 6000 | Snapdragon 8 Elite | 12GB/256GB=54999, 16GB/512GB=59999
iQOO | Neo 9 Pro 5G | Fiery Red, Conqueror Black | 6.78 | 50 | 5160 | Snapdragon 8 Gen 2 | 8GB/128GB=36999, 8GB/256GB=38999, 12GB/256GB=40999
iQOO | Z9s 5G | Titanium Matte, Onyx Green | 6.77 | 50 | 5500 | Dimensity 7300 | 8GB/128GB=19999, 8GB/256GB=21999, 12GB/256GB=23999
iQOO | Z9 Lite 5G | Aqua Flow, Mocha Brown | 6.56 | 50 | 5000 | Dimensity 6300 | 4GB/128GB=10499, 6GB/128GB=11499
Oppo | Find X8 Pro | Pearl White, Space Black | 6.78 | 50 | 5910 | Dimensity 9400 | 16GB/512GB=99999
Oppo | Find X8 | Star Grey, Space Black | 6.59 | 50 | 5630 | Dimensity 9400 | 12GB/256GB=69999, 16GB/512GB=79999
Oppo | Reno13 Pro 5G | Mist Lavender, Graphite Grey | 6.83 | 50 | 5800 | Dimensity 8350 | 12GB/256GB=49999, 12GB/512GB=54999
Oppo | Reno12 Pro 5G | Space Brown, Sunset Gold | 6.7 | 50 | 5000 | Dimensity 7300 Energy | 12GB/256GB=36999, 12GB/512GB=40999
Oppo | Reno12 5G | Astro Silver, Matte Brown, Sunset Peach | 6.7 | 50 | 5000 | Dimensity 7300 Energy | 8GB/256GB=32999
Oppo | F27 Pro+ 5G | Dusk Pink, Midnight Navy | 6.7 | 64 | 5000 | Dimensity 7050 | 8GB/128GB=27999, 8GB/256GB=29999
Oppo | A3 Pro 5G | Moonlight Purple, Starry Black | 6.67 | 50 | 5100 | Dimensity 6300 | 8GB/128GB=17999, 8GB/256GB=19999
Oppo | K12x 5G | Breeze Blue, Midnight Violet | 6.67 | 32 | 5100 | Dimensity 6300 | 6GB/128GB=12999, 8GB/256GB=15999
Motorola | Edge 50 Ultra | Forest Grey, Peach Fuzz, Nordic Wood | 6.7 | 50 | 4500 | Snapdragon 7 Gen 3 | 12GB/512GB=59999
Motorola | Edge 50 Pro | Black Beauty, Luxe Lavender, Moonlight Pearl | 6.7 | 50 | 4500 | Snapdragon 7 Gen 3 | 8GB/256GB=31999, 12GB/256GB=35999
Motorola | Edge 50 Fusion | Forest Blue, Hot Pink, Marshmallow Blue | 6.7 | 50 | 5000 | Snapdragon 7s Gen 2 | 8GB/128GB=22999, 12GB/256GB=24999
Motorola | Edge 50 Neo | Grisaille, Latte, Nautical Blue, Poinciana | 6.4 | 50 | 4310 | Dimensity 7300 | 8GB/256GB=23999
Motorola | Razr 50 Ultra | Midnight Blue, Spring Green, Peach Fuzz | 6.9 | 50 | 4000 | Snapdragon 8s Gen 3 | 12GB/512GB=99999
Motorola | Moto G85 5G | Cobalt Blue, Olive Green, Urban Grey | 6.67 | 50 | 5000 | Snapdragon 6s Gen 3 | 8GB/128GB=17999, 12GB/256GB=19999
Motorola | Moto G64 5G | Mint Green, Pearl Blue, Ice Lilac | 6.5 | 50 | 6000 | Dimensity 7025 | 8GB/128GB=14999, 12GB/256GB=16999
Motorola | Moto G45 5G | Brilliant Blue, Brilliant Green, Viva Magenta | 6.5 | 50 | 5000 | Snapdragon 6s Gen 3 | 4GB/128GB=10999, 8GB/128GB=12999
Motorola | Moto G35 5G | Guava Red, Leaf Green, Midnight Black | 6.72 | 50 | 5000 | Unisoc T760 | 4GB/128GB=9999
Nothing | Phone (3a) | Black, White, Blue | 6.77 | 50 | 5000 | Snapdragon 7s Gen 3 | 8GB/128GB=24999, 8GB/256GB=26999
Nothing | Phone (2a) Plus | Black, Grey | 6.7 | 50 | 5000 | Dimensity 7350 Pro | 8GB/256GB=27999, 12GB/256GB=29999
Nothing | Phone (2a) | Black, White, Milk | 6.7 | 50 | 5000 | Dimensity 7200 Pro | 8GB/128GB=23999, 8GB/256GB=25999, 12GB/256GB=27999
Nothing | Phone (2) | Dark Grey, White | 6.7 | 50 | 4700 | Snapdragon 8+ Gen 1 | 12GB/256GB=44999
CMF | Phone 1 | Black, Blue, Light Green, Orange | 6.67 | 50 | 5000 | Dimensity 7300 | 6GB/128GB=15999, 8GB/128GB=17999
Lava | Agni 3 5G | Heather Glass, Pristine Glass | 6.78 | 50 | 5000 | Dimensity 7300X | 8GB/128GB=20999, 8GB/256GB=24999
Lava | Blaze X 5G | Starlight Purple, Titanium Grey | 6.67 | 64 | 5000 | Dimensity 7050 | 4GB/128GB=14999, 6GB/128GB=15999
Infinix | GT 20 Pro 5G | Mecha Blue, Mecha Orange, Mecha Silver | 6.78 | 108 | 5000 | Dimensity 8200 Ultimate | 8GB/256GB=24999, 12GB/256GB=26999
Infinix | Note 40 Pro 5G | Titan Gold, Vintage Green | 6.78 | 108 | 5000 | Dimensity 7020 | 8GB/256GB=21999
Infinix | Hot 50 5G | Dreamy Purple, Sage Green, Sleek Black | 6.7 | 48 | 5000 | Dimensity 6300 | 4GB/128GB=9999, 8GB/128GB=10999
Tecno | Pova 6 Pro 5G | Comet Green, Meteorite Grey | 6.78 | 108 | 6000 | Dimensity 6080 | 8GB/256GB=19999, 12GB/256GB=21999
Tecno | Camon 30 5G | Basaltic Dark, Uyuni Salt White | 6.78 | 50 | 5000 | Dimensity 7020 | 8GB/256GB=22999, 12GB/256GB=24999
Honor | 200 5G | Moonlight White, Black | 6.7 | 50 | 5200 | Snapdragon 7 Gen 3 | 8GB/256GB=34999, 12GB/512GB=39999
`;

const TABLETS = `
Apple | iPad (10th Gen) Wi-Fi | Blue, Pink, Silver, Yellow | 10.9 | 12 | 7606 | A14 Bionic | 64GB=34900, 256GB=49900
Apple | iPad Air 11-inch (M2) Wi-Fi | Space Grey, Blue, Purple, Starlight | 11 | 12 | 7606 | Apple M2 | 128GB=59900, 256GB=69900
Apple | iPad Pro 11-inch (M4) Wi-Fi | Space Black, Silver | 11 | 12 | 8160 | Apple M4 | 256GB=99900, 512GB=119900
Apple | iPad mini (A17 Pro) Wi-Fi | Space Grey, Blue, Purple, Starlight | 8.3 | 12 | 5078 | A17 Pro | 128GB=49900, 256GB=59900
Samsung | Galaxy Tab S10 Ultra Wi-Fi | Moonstone Grey, Platinum Silver | 14.6 | 13 | 11200 | Dimensity 9300+ | 12GB/256GB=108999
Samsung | Galaxy Tab S9 FE Wi-Fi | Gray, Lavender, Mint, Silver | 10.9 | 8 | 8000 | Exynos 1380 | 6GB/128GB=36999, 8GB/256GB=45999
Samsung | Galaxy Tab A9+ Wi-Fi | Graphite, Silver, Navy | 11 | 8 | 7040 | Snapdragon 695 | 4GB/64GB=18999, 8GB/128GB=22999
Xiaomi | Pad 6 | Graphite Grey, Mist Blue | 11 | 13 | 8840 | Snapdragon 870 | 6GB/128GB=26999, 8GB/256GB=28999
Redmi | Pad Pro | Graphite Grey, Ocean Blue | 12.1 | 8 | 10000 | Snapdragon 7s Gen 2 | 6GB/128GB=23999, 8GB/256GB=27999
Redmi | Pad SE | Graphite Grey, Lavender Purple, Mint Green | 11 | 8 | 8000 | Snapdragon 680 | 4GB/128GB=12999, 6GB/128GB=13999, 8GB/128GB=14999
OnePlus | Pad 2 | Nimbus Grey | 12.1 | 13 | 9510 | Snapdragon 8 Gen 3 | 8GB/128GB=39999, 12GB/256GB=42999
OnePlus | Pad Go | Twin Mint | 11.35 | 8 | 8000 | Helio G99 | 8GB/128GB=19999, 8GB/256GB=23999
Lenovo | Tab M11 | Luna Grey | 11 | 13 | 7040 | Helio G88 | 4GB/128GB=15999
Lenovo | Tab P12 | Storm Grey | 12.7 | 8 | 10200 | Dimensity 7050 | 8GB/128GB=26999
Realme | Pad 2 | Imagination Grey, Inspiration Green | 11.5 | 8 | 8360 | Helio G99 | 6GB/128GB=19999, 8GB/256GB=22999
Honor | Pad 9 | Space Grey | 12.1 | 13 | 8300 | Snapdragon 6 Gen 1 | 8GB/256GB=24999
`;

const LAPTOPS = `
HP | 15s Thin and Light | Natural Silver | Intel Core i3-1215U | Intel UHD Graphics | 15.6 | 8GB/512GB=36990
HP | 15 Laptop | Natural Silver | Intel Core i5-1335U | Intel Iris Xe | 15.6 | 16GB/512GB=57990
HP | 255 G10 | Dark Ash Silver | AMD Ryzen 5 7530U | AMD Radeon | 15.6 | 8GB/512GB=38990, 16GB/512GB=42990
HP | Pavilion 14 | Natural Silver, Warm Gold | Intel Core i5-1335U | Intel Iris Xe | 14 | 16GB/512GB=64990
HP | Pavilion x360 14 | Natural Silver, Pale Rose Gold | Intel Core i5-1335U | Intel Iris Xe | 14 | 16GB/512GB=72990
HP | Envy x360 14 OLED | Glacier Silver | AMD Ryzen 7 8840HS | AMD Radeon 780M | 14 | 16GB/1TB=94990
HP | OmniBook X | Meteor Silver | Snapdragon X Elite | Qualcomm Adreno | 14 | 16GB/1TB=139999
Dell | Inspiron 3520 | Carbon Black, Platinum Silver | Intel Core i3-1215U | Intel UHD Graphics | 15.6 | 8GB/512GB=36990
Dell | Inspiron 3530 | Platinum Silver | Intel Core i5-1334U | Intel Iris Xe | 15.6 | 16GB/512GB=56990
Dell | Inspiron 3530 | Platinum Silver | Intel Core i7-1355U | Intel Iris Xe | 15.6 | 16GB/512GB=68990, 16GB/1TB=74990
Dell | Vostro 3520 | Carbon Black | Intel Core i3-1215U | Intel UHD Graphics | 15.6 | 8GB/512GB=37990
Dell | Inspiron 14 5440 | Ice Blue, Platinum Silver | Intel Core 5 120U | Intel Graphics | 14 | 16GB/512GB=64990
Dell | Inspiron 14 Plus 7440 | Ice Blue | Intel Core Ultra 5 125H | Intel Arc | 14 | 16GB/1TB=89990
Dell | XPS 13 9340 | Platinum, Graphite | Intel Core Ultra 7 155H | Intel Arc | 13.4 | 16GB/512GB=149990
Lenovo | IdeaPad Slim 1 | Cloud Grey | AMD Ryzen 5 7520U | AMD Radeon 610M | 15.6 | 8GB/512GB=33990
Lenovo | IdeaPad Slim 3 | Arctic Grey | Intel Core i3-1215U | Intel UHD Graphics | 15.6 | 8GB/512GB=35990
Lenovo | IdeaPad Slim 3 | Arctic Grey | Intel Core i5-12450H | Intel UHD Graphics | 15.6 | 8GB/512GB=49990, 16GB/512GB=53990
Lenovo | IdeaPad Slim 3 | Arctic Grey, Abyss Blue | AMD Ryzen 7 7730U | AMD Radeon | 15.6 | 16GB/512GB=52990
Lenovo | IdeaPad Slim 5 OLED | Cloud Grey | AMD Ryzen 7 8845HS | AMD Radeon 780M | 14 | 16GB/1TB=74990
Lenovo | IdeaPad Slim 5 | Luna Grey | Intel Core Ultra 5 125H | Intel Arc | 14 | 16GB/512GB=72990
Lenovo | ThinkPad E14 Gen 5 | Graphite Black | Intel Core i5-1335U | Intel Iris Xe | 14 | 16GB/512GB=67990
Lenovo | ThinkBook 15 G5 | Mineral Grey | Intel Core i5-1335U | Intel Iris Xe | 15.6 | 16GB/512GB=57990
Lenovo | Yoga Slim 7 | Luna Grey | Intel Core Ultra 7 155H | Intel Arc | 14 | 16GB/1TB=99990
ASUS | Vivobook Go 15 | Mixed Black | AMD Ryzen 3 7320U | AMD Radeon 610M | 15.6 | 8GB/512GB=32990
ASUS | Vivobook 15 | Quiet Blue, Cool Silver | Intel Core i3-1215U | Intel UHD Graphics | 15.6 | 8GB/512GB=35990
ASUS | Vivobook 15 | Quiet Blue | Intel Core i5-1335U | Intel Iris Xe | 15.6 | 16GB/512GB=55990
ASUS | Vivobook 15 | Indie Black | AMD Ryzen 5 7530U | AMD Radeon | 15.6 | 16GB/512GB=45990
ASUS | Vivobook 16 | Cool Silver | Intel Core i5-12500H | Intel Iris Xe | 16 | 16GB/512GB=56990
ASUS | Vivobook S14 OLED | Neutral Black | Intel Core Ultra 5 125H | Intel Arc | 14 | 16GB/512GB=74990
ASUS | Zenbook 14 OLED | Ponder Blue, Foggy Silver | Intel Core Ultra 5 125H | Intel Arc | 14 | 16GB/512GB=84990
ASUS | Zenbook 14 OLED | Ponder Blue | Intel Core Ultra 7 155H | Intel Arc | 14 | 16GB/1TB=99990
Acer | Aspire Lite | Steel Gray | Intel Core i3-1215U | Intel UHD Graphics | 15.6 | 8GB/512GB=30990
Acer | Aspire Lite | Steel Gray | Intel Core i5-1235U | Intel Iris Xe | 15.6 | 16GB/512GB=41990
Acer | Aspire Lite | Pure Silver | AMD Ryzen 5 5625U | AMD Radeon | 15.6 | 16GB/512GB=37990
Acer | Aspire 3 | Pure Silver | AMD Ryzen 5 7520U | AMD Radeon 610M | 15.6 | 8GB/512GB=34990
Acer | Swift Go 14 OLED | Pure Silver | Intel Core Ultra 5 125H | Intel Arc | 14 | 16GB/512GB=69990
Apple | MacBook Air 13-inch (M4) | Midnight, Starlight, Silver, Sky Blue | Apple M4 | Apple 8-core GPU | 13.6 | 16GB/256GB=99900, 16GB/512GB=119900
Apple | MacBook Air 15-inch (M4) | Midnight, Starlight, Silver, Sky Blue | Apple M4 | Apple 10-core GPU | 15.3 | 16GB/256GB=124900, 16GB/512GB=144900
Apple | MacBook Pro 14-inch (M4) | Space Black, Silver | Apple M4 | Apple 10-core GPU | 14.2 | 16GB/512GB=169900, 16GB/1TB=189900
Apple | MacBook Pro 14-inch (M4 Pro) | Space Black, Silver | Apple M4 Pro | Apple 16-core GPU | 14.2 | 24GB/512GB=199900
Samsung | Galaxy Book4 | Gray, Silver | Intel Core i5-1335U | Intel Iris Xe | 15.6 | 16GB/512GB=65990
MSI | Modern 14 | Classic Black | Intel Core i5-1235U | Intel Iris Xe | 14 | 8GB/512GB=39990, 16GB/512GB=44990
MSI | Modern 15 | Classic Black | Intel Core i7-1255U | Intel Iris Xe | 15.6 | 16GB/512GB=52990
Honor | MagicBook X16 | Space Grey | Intel Core i5-12450H | Intel UHD Graphics | 16 | 16GB/512GB=46990
Infinix | INBook Y2 Plus | Grey, Silver | Intel Core i5-1155G7 | Intel Iris Xe | 15.6 | 8GB/512GB=31990
`;

const GAMING_LAPTOPS = `
ASUS | TUF Gaming F15 | Mecha Gray, Graphite Black | Intel Core i5-11400H | NVIDIA RTX 3050 | 15.6 | 16GB/512GB=54990
ASUS | TUF Gaming F15 | Mecha Gray | Intel Core i7-13620H | NVIDIA RTX 4050 | 15.6 | 16GB/512GB=84990
ASUS | TUF Gaming F16 | Mecha Gray | Intel Core i7-13650HX | NVIDIA RTX 4060 | 16 | 16GB/1TB=104990
ASUS | TUF Gaming A15 | Mecha Gray | AMD Ryzen 7 7435HS | NVIDIA RTX 4050 | 15.6 | 16GB/512GB=74990
ASUS | TUF Gaming A15 | Mecha Gray | AMD Ryzen 7 7735HS | NVIDIA RTX 4060 | 15.6 | 16GB/1TB=89990
ASUS | ROG Strix G16 | Eclipse Gray | Intel Core i7-13650HX | NVIDIA RTX 4060 | 16 | 16GB/1TB=129990
ASUS | ROG Strix G16 | Eclipse Gray | Intel Core i9-14900HX | NVIDIA RTX 4070 | 16 | 16GB/1TB=179990
ASUS | ROG Zephyrus G14 | Eclipse Gray, Platinum White | AMD Ryzen 9 8945HS | NVIDIA RTX 4060 | 14 | 16GB/1TB=169990
HP | Victus 15 | Mica Silver, Performance Blue | AMD Ryzen 5 7535HS | NVIDIA RTX 2050 | 15.6 | 8GB/512GB=49990
HP | Victus 15 | Mica Silver | Intel Core i5-12450H | NVIDIA RTX 3050 | 15.6 | 16GB/512GB=59990
HP | Victus 15 | Mica Silver | Intel Core i5-13420H | NVIDIA RTX 4050 | 15.6 | 16GB/512GB=69990
HP | Omen 16 | Shadow Black | Intel Core i7-13700HX | NVIDIA RTX 4060 | 16.1 | 16GB/1TB=124990
HP | Omen Transcend 14 | Shadow Black | Intel Core Ultra 7 155H | NVIDIA RTX 4060 | 14 | 16GB/1TB=174990
Lenovo | LOQ | Luna Grey | Intel Core i5-12450HX | NVIDIA RTX 3050 | 15.6 | 16GB/512GB=59990
Lenovo | LOQ | Luna Grey | Intel Core i7-13650HX | NVIDIA RTX 4060 | 15.6 | 16GB/1TB=99990
Lenovo | LOQ | Luna Grey | AMD Ryzen 7 7840HS | NVIDIA RTX 4060 | 15.6 | 16GB/512GB=89990
Lenovo | Legion 5 | Luna Grey | Intel Core i7-13650HX | NVIDIA RTX 4060 | 16 | 16GB/1TB=124990
Lenovo | Legion Slim 5 | Misty Grey | AMD Ryzen 7 8845HS | NVIDIA RTX 4060 | 16 | 16GB/1TB=119990
Lenovo | Legion Pro 5 | Onyx Grey | Intel Core i9-14900HX | NVIDIA RTX 4070 | 16 | 32GB/1TB=164990
Acer | Nitro V 15 | Obsidian Black | Intel Core i5-13420H | NVIDIA RTX 3050 | 15.6 | 16GB/512GB=59990
Acer | Nitro V 15 | Obsidian Black | Intel Core i5-13420H | NVIDIA RTX 4050 | 15.6 | 16GB/512GB=69990
Acer | Nitro V 16 | Obsidian Black | AMD Ryzen 7 8845HS | NVIDIA RTX 4060 | 16 | 16GB/1TB=89990
Acer | Aspire 7 | Charcoal Black | Intel Core i5-12450H | NVIDIA RTX 2050 | 15.6 | 16GB/512GB=52990
Acer | Predator Helios Neo 16 | Obsidian Black | Intel Core i7-14700HX | NVIDIA RTX 4060 | 16 | 16GB/1TB=124990
MSI | Thin GF63 | Black | Intel Core i5-12450H | NVIDIA RTX 3050 | 15.6 | 8GB/512GB=49990
MSI | Thin GF63 | Black | Intel Core i7-12650H | NVIDIA RTX 4050 | 15.6 | 16GB/512GB=69990
MSI | Cyborg 15 | Translucent Black | Intel Core i7-12650H | NVIDIA RTX 4060 | 15.6 | 16GB/512GB=84990
MSI | Katana 15 | Black | Intel Core i7-13620H | NVIDIA RTX 4060 | 15.6 | 16GB/1TB=99990
Dell | G15 5530 | Dark Shadow Grey | Intel Core i5-13450HX | NVIDIA RTX 3050 | 15.6 | 16GB/512GB=74990
Dell | G15 5530 | Dark Shadow Grey | Intel Core i7-13650HX | NVIDIA RTX 4060 | 15.6 | 16GB/1TB=104990
Dell | Alienware m16 R2 | Dark Metallic Moon | Intel Core Ultra 9 185H | NVIDIA RTX 4070 | 16 | 32GB/1TB=239990
Gigabyte | G5 | Black | Intel Core i5-12500H | NVIDIA RTX 4050 | 15.6 | 16GB/512GB=69990
`;

const ANC = "Feature: Active Noise Cancellation (ANC)";

const POWER_BANKS = `
Xiaomi | Power Bank 3i | Black, Blue | Output: 18W; Ports: 2 USB + Type-C | Capacity: 10000mAh=1199, 20000mAh=1999
Xiaomi | Pocket Power Bank | Black, Blue | Output: 22W; Ports: 1 USB + Type-C | Capacity: 10000mAh=1299
Ambrane | Stylo Pro Power Bank | Black, Blue, Green | Output: 20W; Ports: 2 USB + Type-C | Capacity: 10000mAh=899, 20000mAh=1499
Ambrane | PowerLit Ultra Power Bank | Black, Blue | Output: 22W; Ports: 2 USB + Type-C | Capacity: 20000mAh=1599, 27000mAh=2499
Anker | PowerCore 10000 PD Redux Power Bank | Black | Output: 25W; Ports: 1 USB + Type-C | Capacity: 10000mAh=2999
Anker | Nano Power Bank | Black, Blue | Output: 30W; Ports: 1 Type-C | Capacity: 10000mAh=3499
Samsung | Super Fast Charging Battery Pack | Gray, Beige | Output: 25W; Ports: 1 USB + Type-C | Capacity: 10000mAh=2999, 20000mAh=4499
URBN | Nano Power Bank | Black, Blue, Camo | Output: 22W; Ports: 1 USB + Type-C | Capacity: 10000mAh=1299, 20000mAh=1899
Portronics | Power Pro Power Bank | Black, Grey | Output: 22W; Ports: 2 USB + Type-C | Capacity: 10000mAh=1199, 20000mAh=1799
boAt | EnergyShroom PB300 Power Bank | Carbon Black, Ocean Blue | Output: 22W; Ports: 2 USB + Type-C | Capacity: 10000mAh=1299
Realme | Power Bank 3 | Black, White | Output: 22W; Ports: 2 USB + Type-C | Capacity: 10000mAh=1199, 20000mAh=1999
Stuffcool | Major Power Bank | Black | Output: 22W; Ports: 2 USB + Type-C | Capacity: 20000mAh=1999
Croma | Fast Charging Power Bank | Black | Output: 22W; Ports: 2 USB + Type-C | Capacity: 10000mAh=999, 20000mAh=1499
`;

const HEADPHONES = `
Apple | AirPods Pro (2nd Generation) with USB-C | White | Type: Earbuds; Battery: 30 hours; ${ANC} | 24900
Apple | AirPods 4 | White | Type: Earbuds; Battery: 30 hours; Feature: Personalised Spatial Audio | 12900
Apple | AirPods 4 with Active Noise Cancellation | White | Type: Earbuds; Battery: 30 hours; ${ANC} | 17900
Apple | AirPods Max | Midnight, Starlight, Blue, Purple, Orange | Type: Headphones; Battery: 20 hours; ${ANC} | 59900
Samsung | Galaxy Buds3 Pro | Silver, White | Type: Earbuds; Battery: 30 hours; ${ANC} | 19999
Samsung | Galaxy Buds3 | Silver, White | Type: Earbuds; Battery: 30 hours; ${ANC} | 14999
Samsung | Galaxy Buds FE | Graphite, White | Type: Earbuds; Battery: 30 hours; ${ANC} | 9999
Sony | WH-1000XM5 Wireless Headphones | Black, Silver, Midnight Blue | Type: Headphones; Battery: 30 hours; ${ANC} | 29990
Sony | WH-1000XM4 Wireless Headphones | Black, Silver, Blue | Type: Headphones; Battery: 30 hours; ${ANC} | 22990
Sony | WF-1000XM5 Earbuds | Black, Silver | Type: Earbuds; Battery: 24 hours; ${ANC} | 24990
Sony | ULT Wear Wireless Headphones | Black, Off White, Forest Gray | Type: Headphones; Battery: 30 hours; ${ANC} | 16990
Sony | WH-CH720N Wireless Headphones | Black, White, Blue | Type: Headphones; Battery: 35 hours; ${ANC} | 9990
Sony | WF-C700N Earbuds | Black, White, Lavender, Sage Green | Type: Earbuds; Battery: 20 hours; ${ANC} | 8990
Sony | WH-CH520 Wireless Headphones | Black, Blue, White, Beige | Type: Headphones; Battery: 50 hours; Feature: Multipoint Connection | 4490
Sony | WI-C100 Wireless Neckband | Black, Blue, White | Type: Neckband; Battery: 25 hours; Feature: IPX4 Water Resistant | 1490
boAt | Airdopes 141 Earbuds | Bold Black, Pure White, Cider Cyan | Type: Earbuds; Battery: 42 hours; Feature: ENx Clear Calls | 1099
boAt | Airdopes 161 Earbuds | Pebble Black, Frosty White | Type: Earbuds; Battery: 40 hours; Feature: ASAP Fast Charge | 899
boAt | Airdopes 311 Pro Earbuds | Active Black, Cool Grey | Type: Earbuds; Battery: 50 hours; Feature: Dual Mic ENx | 1299
boAt | Nirvana Ion Earbuds | Charcoal Black, Ivory White | Type: Earbuds; Battery: 120 hours; Feature: Crystal Bionic Sound | 1999
boAt | Immortal 131 Gaming Earbuds | Black Sabre | Type: Earbuds; Battery: 40 hours; Feature: Low Latency Gaming Mode | 1299
boAt | Rockerz 450 Wireless Headphones | Luscious Black, Aqua Blue, Hazel Beige | Type: Headphones; Battery: 15 hours; Feature: Dual Mode | 1499
boAt | Rockerz 550 Wireless Headphones | Black Symphony, Red Stellar | Type: Headphones; Battery: 20 hours; Feature: Physical Noise Isolation | 1799
boAt | Rockerz 255 Pro+ Neckband | Active Black, Navy Blue, Teal Green | Type: Neckband; Battery: 60 hours; Feature: ASAP Fast Charge | 1299
boAt | BassHeads 100 Wired Earphones | Black, Blue, Red | Type: Wired Earphones; Feature: In-line Mic | 399
Noise | Buds VS104 Earbuds | Charcoal Black, Snow White, Mint Green | Type: Earbuds; Battery: 45 hours; Feature: Quad Mic ENC | 999
Noise | Buds N1 Earbuds | Carbon Black, Ice White | Type: Earbuds; Battery: 40 hours; Feature: Low Latency Mode | 1099
Noise | Two Wireless Headphones | Jet Black, Space Blue | Type: Headphones; Battery: 50 hours; Feature: Dual Pairing | 1999
JBL | Tune 520BT Wireless Headphones | Black, Blue, White, Purple | Type: Headphones; Battery: 57 hours; Feature: Pure Bass Sound | 3499
JBL | Tune 770NC Wireless Headphones | Black, Blue, White | Type: Headphones; Battery: 70 hours; ${ANC} | 6999
JBL | Live 770NC Wireless Headphones | Black, Blue, White, Sandstone | Type: Headphones; Battery: 65 hours; ${ANC} | 12999
JBL | Tune Beam Earbuds | Black, Blue, White | Type: Earbuds; Battery: 48 hours; ${ANC} | 5999
JBL | Wave Beam Earbuds | Black, Blue, White | Type: Earbuds; Battery: 32 hours; Feature: Deep Bass Sound | 3499
OnePlus | Buds Pro 3 | Midnight Opus, Lunar Radiance | Type: Earbuds; Battery: 43 hours; ${ANC} | 11999
OnePlus | Buds 3 | Metallic Gray, Splendid Blue | Type: Earbuds; Battery: 44 hours; ${ANC} | 5499
OnePlus | Nord Buds 2r | Deep Grey, Triple Blue | Type: Earbuds; Battery: 38 hours; Feature: Dual Mic AI Clear Calls | 2199
OnePlus | Bullets Wireless Z2 Neckband | Magico Black, Beam Blue | Type: Neckband; Battery: 30 hours; Feature: Fast Charging | 1999
Realme | Buds Air 6 | Flame Silver, Forest Green | Type: Earbuds; Battery: 40 hours; ${ANC} | 3299
Realme | Buds T300 | Stylish Black, Youth White | Type: Earbuds; Battery: 40 hours; ${ANC} | 2299
Nothing | Ear | Black, White | Type: Earbuds; Battery: 40 hours; ${ANC} | 11999
Nothing | Ear (a) | Black, White, Yellow | Type: Earbuds; Battery: 42 hours; ${ANC} | 7999
CMF | Buds Pro 2 | Dark Grey, Light Grey, Blue, Orange | Type: Earbuds; Battery: 43 hours; ${ANC} | 4299
Jabra | Elite 4 Earbuds | Dark Grey, Navy, Lilac | Type: Earbuds; Battery: 28 hours; ${ANC} | 9999
Sennheiser | Momentum 4 Wireless Headphones | Black, White, Graphite | Type: Headphones; Battery: 60 hours; ${ANC} | 34990
Sennheiser | Accentum Wireless Headphones | Black, White | Type: Headphones; Battery: 50 hours; ${ANC} | 14990
Bose | QuietComfort Ultra Headphones | Black, White Smoke, Sandstone | Type: Headphones; Battery: 24 hours; ${ANC} | 35900
Bose | QuietComfort Headphones | Black, White Smoke, Cypress Green | Type: Headphones; Battery: 24 hours; ${ANC} | 29900
Marshall | Major IV Wireless Headphones | Black, Brown | Type: Headphones; Battery: 80 hours; Feature: Wireless Charging | 14999
Boult | Z40 Earbuds | Black, Blue, Green | Type: Earbuds; Battery: 60 hours; Feature: Zen Mode ENC | 999
HyperX | Cloud II Gaming Headset | Black, Red | Type: Gaming Headset; Feature: 7.1 Surround Sound | 7990
HyperX | Cloud Stinger 2 Gaming Headset | Black | Type: Gaming Headset; Feature: DTS Spatial Audio | 4490
Logitech | G435 Lightspeed Wireless Gaming Headset | Black, White, Blue | Type: Gaming Headset; Battery: 18 hours; Feature: Lightspeed Wireless | 6995
Razer | BlackShark V2 X Gaming Headset | Black | Type: Gaming Headset; Feature: 7.1 Surround Sound | 4999
Cosmic Byte | GS430 Gaming Headset | Black, Blue | Type: Gaming Headset; Feature: Noise Isolating Mic | 1299
`;

const SMART_WATCHES = `
Apple | Watch Series 10 GPS 42mm | Jet Black, Silver, Rose Gold | Case Size: 42mm; Battery: 1.5 days; Feature: ECG and Sleep Apnoea Alerts | 46900
Apple | Watch Series 10 GPS 46mm | Jet Black, Silver, Rose Gold | Case Size: 46mm; Battery: 1.5 days; Feature: ECG and Sleep Apnoea Alerts | 49900
Apple | Watch SE (2nd Gen) GPS 40mm | Midnight, Starlight, Silver | Case Size: 40mm; Battery: 1.5 days; Feature: Crash Detection | 24900
Apple | Watch Ultra 2 GPS + Cellular 49mm | Natural Titanium, Black Titanium | Case Size: 49mm; Battery: 3 days; Feature: Dual-Frequency GPS | 89900
Samsung | Galaxy Watch7 40mm Bluetooth | Green, Cream | Display: 1.3 inch AMOLED; Battery: 2 days; Feature: BioActive Sensor | 29999
Samsung | Galaxy Watch7 44mm Bluetooth | Green, Silver | Display: 1.5 inch AMOLED; Battery: 2 days; Feature: BioActive Sensor | 32999
Samsung | Galaxy Watch Ultra LTE 47mm | Titanium Gray, Titanium Silver, Titanium White | Display: 1.5 inch AMOLED; Battery: 4 days; Feature: Dual-Frequency GPS | 59999
Samsung | Galaxy Watch FE Bluetooth | Black, Silver, Pink Gold | Display: 1.2 inch AMOLED; Battery: 1.5 days; Feature: Sleep Coaching | 19999
Samsung | Galaxy Fit3 | Gray, Silver, Pink Gold | Display: 1.6 inch AMOLED; Battery: 13 days; Feature: 100+ Workout Modes | 4999
OnePlus | Watch 2 | Black Steel, Radiant Steel | Display: 1.43 inch AMOLED; Battery: 4 days; Feature: Dual-Frequency GPS | 24999
OnePlus | Watch 2R | Forest Green, Gunmetal Gray | Display: 1.43 inch AMOLED; Battery: 4 days; Feature: Dual-Frequency GPS | 17999
Amazfit | Balance Smart Watch | Midnight, Sunset | Display: 1.5 inch AMOLED; Battery: 14 days; Feature: Body Composition | 19999
Amazfit | GTR 4 Smart Watch | Superspeed Black, Racetrack Grey | Display: 1.43 inch AMOLED; Battery: 14 days; Feature: Dual-Band GPS | 16999
Amazfit | Active Smart Watch | Midnight Black, Petal Pink, Lavender Purple | Display: 1.75 inch AMOLED; Battery: 14 days; Feature: AI Fitness Coach | 12999
Amazfit | Bip 5 Smart Watch | Soft Black, Cream White, Pastel Pink | Display: 1.91 inch LCD; Battery: 10 days; Feature: Bluetooth Calling | 7999
Noise | ColorFit Pro 6 Smart Watch | Jet Black, Elite Silver | Display: 1.85 inch AMOLED; Battery: 7 days; Feature: Bluetooth Calling | 5499
Noise | NoiseFit Halo Smart Watch | Elite Black, Vintage Brown | Display: 1.43 inch AMOLED; Battery: 7 days; Feature: Bluetooth Calling | 3499
Noise | ColorFit Pulse 4 Smart Watch | Jet Black, Rose Pink, Space Blue | Display: 1.85 inch AMOLED; Battery: 7 days; Feature: Bluetooth Calling | 1599
Noise | ColorFit Icon 2 Smart Watch | Jet Black, Rose Pink, Olive Green | Display: 1.8 inch LCD; Battery: 7 days; Feature: Bluetooth Calling | 1299
boAt | Lunar Discovery Smart Watch | Active Black, Steel Blue | Display: 1.39 inch AMOLED; Battery: 7 days; Feature: Bluetooth Calling | 2499
boAt | Wave Call 2 Smart Watch | Active Black, Deep Blue, Cherry Blossom | Display: 1.83 inch HD; Battery: 7 days; Feature: Bluetooth Calling | 1299
boAt | Storm Call 3 Smart Watch | Active Black, Teal Green | Display: 1.83 inch HD; Battery: 7 days; Feature: Bluetooth Calling | 1099
Fire-Boltt | Ninja Call Pro Plus Smart Watch | Black, Blue, Pink, Grey | Display: 1.83 inch HD; Battery: 7 days; Feature: Bluetooth Calling | 1199
Fire-Boltt | Phoenix Ultra Smart Watch | Black, Gold, Silver | Display: 1.39 inch HD; Battery: 7 days; Feature: Stainless Steel Body | 1499
Fastrack | Limitless FS1 Smart Watch | Black, Blue, Pink | Display: 1.95 inch HD; Battery: 7 days; Feature: Bluetooth Calling | 1999
Garmin | Forerunner 265 | Black, Whitestone, Aqua | Display: 1.3 inch AMOLED; Battery: 13 days; Feature: Training Readiness | 49990
Garmin | Venu Sq 2 | Shadow Grey, Cream Gold | Display: 1.41 inch AMOLED; Battery: 11 days; Feature: Body Battery Energy Monitor | 29990
Garmin | Instinct 2 | Graphite, Tidal Blue | Display: 0.9 inch MIP; Battery: 28 days; Feature: Military Grade Toughness | 33490
Xiaomi | Smart Band 9 | Midnight Black, Glacier Silver, Mystic Rose | Display: 1.62 inch AMOLED; Battery: 21 days; Feature: 150+ Sports Modes | 3999
Redmi | Watch 5 Active | Matte Black, Silver Grey | Display: 2 inch LCD; Battery: 18 days; Feature: Bluetooth Calling | 2799
Fitbit | Charge 6 | Obsidian, Porcelain, Coral | Display: 1.04 inch AMOLED; Battery: 7 days; Feature: Built-in GPS | 14999
CMF | Watch Pro 2 | Dark Grey, Ash Grey, Blue, Orange | Display: 1.32 inch AMOLED; Battery: 11 days; Feature: Interchangeable Bezel | 4999
`;

const LIPSTICKS = `
Lakme | 9 to 5 Primer + Matte Lipstick 3.6g | Red, Maroon, Pink, Nude, Coral, Brown, Berry | Finish: Matte; Feature: Long Lasting | 650
Lakme | Forever Matte Liquid Lip Colour 5.6ml | Red, Pink, Nude, Wine, Coral | Finish: Matte; Feature: Transfer Proof | 399
Lakme | Absolute Matte Revolution Lip Colour 3.5g | Red, Maroon, Pink, Peach | Finish: Matte; Feature: Hydrating | 900
Maybelline | SuperStay Matte Ink Liquid Lipstick 5ml | Red, Pink, Nude, Mauve, Brown, Berry | Finish: Matte; Feature: 16 Hour Wear | 699
Maybelline | Color Sensational Creamy Matte Lipstick 3.9g | Red, Pink, Nude, Coral, Wine | Finish: Creamy Matte; Feature: Moisturising | 399
L'Oreal | Color Riche Satin Lipstick 3.7g | Red, Pink, Nude, Wine | Finish: Satin; Feature: Argan Oil | 950
MAC | Retro Matte Lipstick 3g | Red, Pink, Maroon, Nude | Finish: Matte; Feature: Long Lasting | 2050
Sugar Cosmetics | Matte As Hell Crayon Lipstick 2.8g | Red, Maroon, Nude, Brown, Pink, Coral | Finish: Matte; Feature: Waterproof | 799
Sugar Cosmetics | Smudge Me Not Liquid Lipstick 4.5ml | Red, Brown, Nude, Wine, Pink | Finish: Matte; Feature: Transfer Proof | 599
Swiss Beauty | Velvet Matte Lipstick 3.5g | Red, Pink, Nude, Maroon | Finish: Matte; Feature: Long Lasting | 249
Nykaa | So Matte Lipstick 4.2g | Red, Pink, Nude, Brown | Finish: Matte; Feature: Lightweight | 499
Faces Canada | Weightless Creme Matte Lipstick 3.5g | Red, Pink, Nude, Coral | Finish: Creme Matte; Feature: Lightweight | 499
Colorbar | Velvet Matte Lipstick 4.2g | Red, Pink, Nude, Maroon, Peach | Finish: Matte; Feature: Vitamin E | 750
Elle 18 | Color Pops Matte Lipstick 4.3g | Red, Pink, Coral, Nude | Finish: Matte; Feature: Bright Colour | 160
Revlon | Super Lustrous Lipstick 4.2g | Red, Pink, Nude, Berry | Finish: Creamy; Feature: Vitamin E | 795
Kay Beauty | Matte Drama Long Stay Lipstick 3.6g | Red, Nude, Pink, Brown | Finish: Matte; Feature: Long Stay | 1199
Insight Cosmetics | Matte Lipstick 3.8g | Red, Pink, Nude | Finish: Matte; Feature: Long Lasting | 199
`;

const EYE_MAKEUP = `
Lakme | Eyeconic Kajal 0.35g | Black, Blue, Brown | Type: Kajal; Feature: Smudge Proof | 260
Lakme | Insta Eye Liner 9ml | Black, Blue | Type: Eyeliner; Feature: Quick Dry | 225
Lakme | Eyeconic Lash Curling Mascara 9ml | Black | Type: Mascara; Feature: Curling | 550
Maybelline | Colossal Kajal 0.35g | Black, Brown | Type: Kajal; Feature: Smudge Proof | 229
Maybelline | Lash Sensational Mascara 10ml | Black | Type: Mascara; Feature: Volumising | 749
Maybelline | Hyper Easy Liquid Eyeliner 0.6g | Black | Type: Eyeliner; Feature: Waterproof | 449
L'Oreal | Voluminous Lash Paradise Mascara 6.4ml | Black, Brown | Type: Mascara; Feature: Volumising | 950
Sugar Cosmetics | Kohl Of Honour Intense Kajal 0.25g | Black, Blue, Brown | Type: Kajal; Feature: Waterproof | 399
Faces Canada | Magneteyes Kajal 0.35g | Black | Type: Kajal; Feature: Smudge Proof | 249
Swiss Beauty | Bold Matte Liquid Eyeliner 5ml | Black, Blue, Green | Type: Eyeliner; Feature: Waterproof | 199
Himalaya | Kajal 2.7g | Black | Type: Kajal; Feature: Herbal | 185
`;

const SKIN_CARE = `
Cetaphil | Gentle Skin Cleanser | | Skin Type: All Skin Types; Type: Face Wash | Size: 125ml=499, 250ml=899
Neutrogena | Ultra Sheer Sunscreen SPF 50+ | | Skin Type: All Skin Types; Type: Sunscreen | Size: 30ml=399, 88ml=899
Minimalist | 10% Niacinamide Face Serum | | Skin Type: Oily Skin; Type: Serum | Size: 30ml=599
Minimalist | 10% Vitamin C Face Serum | | Skin Type: All Skin Types; Type: Serum | Size: 30ml=699
Minimalist | SPF 50 Sunscreen | | Skin Type: All Skin Types; Type: Sunscreen | Size: 50ml=399
The Derma Co | 1% Hyaluronic Sunscreen Aqua Gel SPF 50 | | Skin Type: All Skin Types; Type: Sunscreen | Size: 50ml=499
Pilgrim | 10% Vitamin C Face Serum | | Skin Type: All Skin Types; Type: Serum | Size: 30ml=599
Mamaearth | Ubtan Face Wash | | Skin Type: All Skin Types; Type: Face Wash | Size: 100ml=299, 150ml=399
Mamaearth | Vitamin C Face Wash | | Skin Type: All Skin Types; Type: Face Wash | Size: 100ml=349
Himalaya | Purifying Neem Face Wash | | Skin Type: Oily Skin; Type: Face Wash | Size: 100ml=180, 200ml=300
Nivea | Soft Light Moisturising Cream | | Skin Type: All Skin Types; Type: Moisturiser | Size: 100ml=275, 200ml=450
Nivea | Nourishing Body Milk Lotion | | Skin Type: Dry Skin; Type: Body Lotion | Size: 200ml=299, 400ml=499
Pond's | Super Light Gel Moisturiser | | Skin Type: Oily Skin; Type: Moisturiser | Size: 100ml=325
Lakme | Sun Expert Ultra Matte SPF 50 Lotion | | Skin Type: Oily Skin; Type: Sunscreen | Size: 50ml=299, 100ml=499
Biotique | Morning Nectar Flawless Skin Lotion | | Skin Type: All Skin Types; Type: Moisturiser | Size: 120ml=275, 190ml=399
Lotus Herbals | Safe Sun Matte Gel SPF 50 | | Skin Type: Oily Skin; Type: Sunscreen | Size: 100ml=595
Dot & Key | Watermelon Cooling Sunscreen SPF 50 | | Skin Type: All Skin Types; Type: Sunscreen | Size: 50ml=445
Garnier | Bright Complete Vitamin C Face Wash | | Skin Type: All Skin Types; Type: Face Wash | Size: 100ml=199, 150ml=279
WOW Skin Science | Apple Cider Vinegar Face Wash | | Skin Type: All Skin Types; Type: Face Wash | Size: 100ml=349
`;

const STAPLES = `
Aashirvaad | Shudh Chakki Atta | | Type: Whole Wheat Atta | Weight: 5kg=299, 10kg=579
Fortune | Chakki Fresh Atta | | Type: Whole Wheat Atta | Weight: 5kg=285, 10kg=550
Pillsbury | Chakki Fresh Atta | | Type: Whole Wheat Atta | Weight: 5kg=275, 10kg=530
Patanjali | Chakki Fresh Atta | | Type: Whole Wheat Atta | Weight: 5kg=255, 10kg=499
India Gate | Classic Basmati Rice | | Type: Basmati Rice | Weight: 1kg=225, 5kg=1050
India Gate | Feast Rozzana Basmati Rice | | Type: Basmati Rice | Weight: 1kg=125, 5kg=599
Daawat | Rozana Super Basmati Rice | | Type: Basmati Rice | Weight: 1kg=110, 5kg=525
Kohinoor | Super Silver Aged Basmati Rice | | Type: Basmati Rice | Weight: 1kg=175, 5kg=799
Fortune | Biryani Special Basmati Rice | | Type: Basmati Rice | Weight: 1kg=199, 5kg=899
Tata Sampann | Unpolished Toor Dal | | Type: Pulses | Weight: 500g=105, 1kg=199
Tata Sampann | Unpolished Moong Dal | | Type: Pulses | Weight: 500g=95, 1kg=179
Tata Sampann | Unpolished Chana Dal | | Type: Pulses | Weight: 500g=69, 1kg=125
Tata Sampann | Unpolished Rajma | | Type: Pulses | Weight: 500g=119, 1kg=225
Tata Sampann | Besan | | Type: Gram Flour | Weight: 500g=69, 1kg=129
Fortune | Besan | | Type: Gram Flour | Weight: 500g=65, 1kg=125
Madhur | Pure and Hygienic Sugar | | Type: Sugar | Weight: 1kg=60, 5kg=290
Tata Salt | Vacuum Evaporated Iodised Salt | | Type: Salt | Weight: 1kg=28
Aashirvaad | Iodised Salt | | Type: Salt | Weight: 1kg=28
`;

const OILS = `
Fortune | Sunlite Refined Sunflower Oil | | Type: Sunflower Oil | Size: 1L=165, 5L=799
Saffola | Gold Blended Oil | | Type: Blended Oil | Size: 1L=199, 5L=949
Fortune | Kachi Ghani Pure Mustard Oil | | Type: Mustard Oil | Size: 1L=185, 5L=899
Patanjali | Kachi Ghani Mustard Oil | | Type: Mustard Oil | Size: 1L=175, 5L=849
Dhara | Kachi Ghani Mustard Oil | | Type: Mustard Oil | Size: 1L=179
Fortune | Rice Bran Health Oil | | Type: Rice Bran Oil | Size: 1L=175, 5L=849
Figaro | Pure Olive Oil | | Type: Olive Oil | Size: 500ml=549, 1L=999
Amul | Pure Ghee | | Type: Ghee | Size: 500ml=330, 1L=650
Gowardhan | Premium Cow Ghee | | Type: Ghee | Size: 500ml=340, 1L=660
Patanjali | Cow's Ghee | | Type: Ghee | Size: 500ml=345, 1L=675
Mother Dairy | Cow Ghee | | Type: Ghee | Size: 1L=640
Nandini | Pure Ghee | | Type: Ghee | Size: 500ml=330, 1L=650
`;

const TEA_COFFEE = `
Tata Tea | Premium | | Type: Black Tea | Weight: 500g=290, 1kg=560
Tata Tea | Gold | | Type: Black Tea | Weight: 500g=340, 1kg=650
Red Label | Tea | | Type: Black Tea | Weight: 500g=290, 1kg=560
Taj Mahal | Tea | | Type: Black Tea | Weight: 500g=380
Wagh Bakri | Premium Leaf Tea | | Type: Black Tea | Weight: 500g=280, 1kg=545
Society | Leaf Tea | | Type: Black Tea | Weight: 500g=290
Tetley | Lemon and Honey Green Tea | | Type: Green Tea | Pack: 100 Bags=599
Lipton | Honey Lemon Green Tea | | Type: Green Tea | Pack: 100 Bags=575
Organic India | Tulsi Green Tea | | Type: Green Tea | Pack: 25 Bags=180
Nescafe | Classic Instant Coffee | | Type: Instant Coffee | Weight: 100g=360, 200g=699
Bru | Instant Coffee | | Type: Instant Coffee | Weight: 100g=250, 200g=490
Davidoff | Rich Aroma Instant Coffee | | Type: Instant Coffee | Weight: 100g=599
Blue Tokai | Attikan Estate Filter Coffee | | Type: Filter Coffee | Weight: 250g=550
Cothas | Filter Coffee Powder | | Type: Filter Coffee | Weight: 500g=360
`;

const SNACKS = `
Haldiram's | Aloo Bhujia | | Type: Namkeen | Weight: 200g=55, 400g=105, 1kg=240
Haldiram's | Moong Dal | | Type: Namkeen | Weight: 200g=55, 400g=105
Haldiram's | Navratan Mixture | | Type: Namkeen | Weight: 400g=110
Bikaji | Bikaneri Bhujia | | Type: Namkeen | Weight: 400g=110, 1kg=260
Lay's | Classic Salted Potato Chips | | Type: Chips | Weight: 52g=20, 115g=50
Lay's | Magic Masala Potato Chips | | Type: Chips | Weight: 52g=20, 115g=50
Kurkure | Masala Munch | | Type: Chips | Weight: 82g=20, 200g=50
Bingo | Mad Angles Achaari Masti | | Type: Chips | Weight: 66g=20, 130g=40
Pringles | Original Potato Crisps | | Type: Chips | Weight: 107g=115
Parle | Parle-G Original Glucose Biscuits | | Type: Biscuits | Weight: 250g=25, 800g=80
Britannia | Good Day Cashew Cookies | | Type: Biscuits | Weight: 200g=40, 600g=120
Britannia | Marie Gold | | Type: Biscuits | Weight: 250g=35
Cadbury | Oreo Chocolate Sandwich Biscuits | | Type: Biscuits | Weight: 120g=30, 300g=80
Parle | Hide & Seek Chocolate Chip Cookies | | Type: Biscuits | Weight: 200g=50
Unibic | Choco Chip Cookies | | Type: Biscuits | Weight: 500g=150
Britannia | Toastea Premium Bake Rusk | | Type: Rusk | Weight: 300g=50
Cadbury | Dairy Milk Silk | | Type: Chocolate | Weight: 60g=80, 150g=180
`;

const TROLLEY_BAGS = `
American Tourister | Ivy Hard Trolley Bag | Black, Blue, Red | Material: Polypropylene; Wheels: 4 Wheels; Lock: Number Lock | Size: Cabin 55cm=3299, Medium 68cm=4299, Large 77cm=5299
American Tourister | Linex Spinner Trolley Bag | Black, Grey, Teal | Material: Polycarbonate; Wheels: 4 Wheels; Lock: TSA Lock | Size: Cabin 55cm=4499, Medium 66cm=5499
Safari | Thorium Sharp Antiscratch Trolley Bag | Blue, Black, Cyan | Material: Polypropylene; Wheels: 8 Wheels; Lock: Number Lock | Size: Cabin 55cm=2699, Medium 66cm=3499, Large 77cm=4299
Safari | Pentagon Trolley Bag | Black, Blue, Red | Material: Polypropylene; Wheels: 4 Wheels; Lock: Number Lock | Size: Cabin 55cm=2499, Medium 65cm=3199
VIP | Elanza Hard Trolley Bag | Black, Blue, Green | Material: Polypropylene; Wheels: 8 Wheels; Lock: Number Lock | Size: Cabin 55cm=3499, Medium 68cm=4499
Skybags | Trooper Hard Trolley Bag | Black, Blue, Orange | Material: Polypropylene; Wheels: 8 Wheels; Lock: Number Lock | Size: Cabin 55cm=2999, Medium 65cm=3799
Aristocrat | Airpro Hard Trolley Bag | Black, Blue, Red | Material: Polypropylene; Wheels: 4 Wheels; Lock: Number Lock | Size: Cabin 55cm=1999, Medium 65cm=2599
Nasher Miles | Rome Hard Trolley Bag | Black, Blue, Pink, Green | Material: Polycarbonate; Wheels: 8 Wheels; Lock: TSA Lock | Size: Cabin 55cm=2999, Medium 65cm=3999, Large 75cm=4999
Mokobara | The Transit Trolley Bag | Black, Blue, Beige | Material: Polycarbonate; Wheels: 8 Wheels; Lock: TSA Lock | Size: Cabin 55cm=6999, Medium 66cm=8999
Uppercase | Topcase Hard Trolley Bag | Black, Blue, Green | Material: Polypropylene; Wheels: 8 Wheels; Lock: TSA Lock | Size: Cabin 55cm=3299, Medium 65cm=4299
Kamiliant | Harrier Hard Trolley Bag | Black, Blue, Red | Material: Polypropylene; Wheels: 4 Wheels; Lock: Number Lock | Size: Cabin 55cm=2499, Medium 68cm=3299
`;

const BACKPACKS = `
Wildcraft | Wiki 1 Laptop Backpack | Black, Navy Blue, Grey | Capacity: 30L; Material: Polyester | 1599
Wildcraft | Trailblazer Trekking Rucksack | Black, Green, Blue | Capacity: 45L; Material: Nylon | 2999
Wildcraft | Wiki Squad School Bag | Black, Blue, Red | Capacity: 32L; Material: Polyester | 1299
Skybags | Brat Laptop Backpack | Black, Blue, Grey | Capacity: 26L; Material: Polyester | 1299
Skybags | Campus Plus School Bag | Black, Blue, Red | Capacity: 30L; Material: Polyester | 1199
American Tourister | Valex Laptop Backpack | Black, Grey, Navy Blue | Capacity: 28L; Material: Polyester | 1699
American Tourister | Urban Groove Laptop Backpack | Black, Grey | Capacity: 31L; Material: Polyester | 2299
Safari | Ray College Bag | Black, Blue, Grey | Capacity: 30L; Material: Polyester | 999
F Gear | Luxur Laptop Backpack | Black, Grey | Capacity: 25L; Material: Polyester | 999
HP | Prelude Pro 15.6 inch Laptop Backpack | Black | Capacity: 20L; Material: Polyester | 1499
Dell | Essential 15 inch Laptop Backpack | Black | Capacity: 18L; Material: Polyester | 1299
Lenovo | B210 15.6 inch Laptop Backpack | Black | Capacity: 18L; Material: Polyester | 999
Puma | Phase Backpack | Black, Navy Blue, Red | Capacity: 22L; Material: Polyester | 1499
Adidas | Classic Backpack | Black, Blue | Capacity: 25L; Material: Polyester | 1799
Nike | Heritage Backpack | Black, Grey | Capacity: 25L; Material: Polyester | 1995
Mokobara | The Em Laptop Backpack | Black, Beige, Blue | Capacity: 22L; Material: Nylon | 3999
Tommy Hilfiger | Laptop Backpack | Black, Navy Blue | Capacity: 24L; Material: Polyester | 3999
Gear | Classic Anti-Theft Laptop Backpack | Black, Grey | Capacity: 25L; Material: Polyester | 1499
`;

const TRAVEL_ACCESSORIES = `
Mokobara | Memory Foam Travel Neck Pillow | Black, Blue, Beige | Material: Memory Foam | 1299
Wildcraft | Inflatable Travel Neck Pillow | Black, Blue | Material: Nylon | 499
Portronics | Adapto Universal Travel Adapter | White, Black | Material: ABS Plastic; Feature: Works in 150+ Countries | 899
Belkin | Universal Travel Adapter with USB-C | White | Material: ABS Plastic; Feature: Works in 150+ Countries | 1999
Safari | 3 Digit Number Luggage Lock | Black, Silver | Material: Zinc Alloy | 299
American Tourister | TSA Luggage Lock | Black | Material: Zinc Alloy; Feature: TSA Approved | 699
Mokobara | Packing Cubes Set of 3 | Black, Blue, Beige | Material: Nylon | 1999
Nasher Miles | Packing Cubes Set of 6 | Black, Grey, Pink | Material: Polyester | 1499
Uppercase | Toiletry Kit | Black, Green | Material: Polyester; Feature: Water Resistant | 999
Kuber Industries | Travel Organiser Pouch | Black, Grey, Blue | Material: Polyester | 399
Mokobara | Passport Cover | Black, Blue, Beige | Material: Vegan Leather | 999
`;

const LIGHTING = `
Philips | Stellar Bright B22 LED Bulb | | Light Colour: Cool Day Light; Life: 15000 hours | Power: 9W=110, 12W=170, 20W=310
Syska | SSK B22 LED Bulb | | Light Colour: Cool Day Light; Life: 15000 hours | Power: 9W=99, 12W=149, 20W=299
Wipro | Garnet B22 LED Bulb | | Light Colour: Cool Day Light; Life: 25000 hours | Power: 9W=99, 12W=159, 20W=299
Havells | Adore B22 LED Bulb | | Light Colour: Warm White; Life: 25000 hours | Power: 9W=105, 12W=165
Halonix | Prime B22 LED Bulb | | Light Colour: Cool Day Light; Life: 15000 hours | Power: 9W=95, 12W=150
Crompton | Lazer Ray B22 LED Bulb | | Light Colour: Neutral White; Life: 15000 hours | Power: 9W=99, 12W=159
Wipro | Smart Wi-Fi LED Bulb | | Light Colour: 16 Million Colours; Life: 25000 hours | Power: 9W=499, 12W=699
Philips | Safe Lite Emergency LED Bulb | | Light Colour: Cool Day Light; Feature: 4 Hours Battery Backup | Power: 9W=549
Wipro | Emergency LED Bulb | | Light Colour: Cool Day Light; Feature: 4 Hours Battery Backup | Power: 9W=449
Philips | T5 LED Batten | | Light Colour: Cool Day Light; Life: 25000 hours | Power: 20W=499
Syska | LED Batten | | Light Colour: Cool Day Light; Life: 25000 hours | Power: 20W=399
Desidiya | Copper LED String Lights 10m | Warm White, Multicolour | Feature: Diwali Decoration; Life: 15000 hours | 299
Syska | Rice LED String Lights 12m | Warm White, Multicolour | Feature: Festival Decoration; Life: 15000 hours | 349
Philips | Ultra Bright LED Desk Lamp | White | Light Colour: Cool Day Light; Feature: Touch Control | 1499
`;

const KITCHEN = `
Prestige | Popular Aluminium Pressure Cooker | Silver | Material: Aluminium | Capacity: 3L=1299, 5L=1799
Prestige | Svachh Stainless Steel Pressure Cooker | Silver | Material: Stainless Steel | Capacity: 3L=2299, 5L=2999
Hawkins | Contura Hard Anodised Pressure Cooker | Black | Material: Hard Anodised | Capacity: 3L=2350, 5L=2950
Hawkins | Classic Aluminium Pressure Cooker | Silver | Material: Aluminium | Capacity: 3L=1550, 5L=1950
Pigeon | Special Aluminium Pressure Cooker | Silver | Material: Aluminium | Capacity: 3L=899, 5L=1199
Prestige | Omega Deluxe Non-Stick Tawa | Black | Material: Non-Stick Aluminium; Diameter: 25cm | 1195
Pigeon | Basics Non-Stick Kadhai | Black | Material: Non-Stick Aluminium; Diameter: 24cm | 799
Milton | Thermosteel Flip Lid Flask | Silver, Black, Blue | Material: Stainless Steel | Capacity: 500ml=799, 1L=1099
Cello | Puro Steel-X Water Bottle | Silver, Blue, Green | Material: Stainless Steel | Capacity: 900ml=449
Borosil | Hydra Trek Steel Water Bottle | Silver, Black | Material: Stainless Steel | Capacity: 1L=899
Milton | Steel Combi Lunch Box | Silver, Blue | Material: Stainless Steel; Feature: 3 Containers | 499
Tupperware | Classic Lunch Box | Blue, Green, Red | Material: Food Grade Plastic; Feature: Leak Proof | 599
Butterfly | Jet Elite Mixer Grinder | White, Blue | Power: 750W; Feature: 4 Jars | 4499
Bajaj | Rex Mixer Grinder | White | Power: 500W; Feature: 3 Jars | 2499
Philips | HL7756 Mixer Grinder | Black | Power: 750W; Feature: 3 Jars | 4999
Preethi | Zodiac Mixer Grinder | Black | Power: 750W; Feature: 5 Jars | 7999
Prestige | Iris Mixer Grinder | Purple | Power: 750W; Feature: 4 Jars | 3299
Pigeon | Acer Plus Induction Cooktop | Black | Power: 1800W; Feature: Push Button Controls | 1999
Wonderchef | Nutri-Blend Mixer Grinder | Black, Red | Power: 400W; Feature: 2 Jars | 2999
`;

const DIAPERS = `
Pampers | All Round Protection Diaper Pants | | Type: Diaper Pants; Protection: 12 hours | Pack: 30 Pieces=599, 60 Pieces=1099, 90 Pieces=1549
Pampers | Premium Care Diaper Pants | | Type: Diaper Pants; Protection: 12 hours | Pack: 30 Pieces=799, 60 Pieces=1499
Huggies | Wonder Pants Diaper Pants | | Type: Diaper Pants; Protection: 12 hours | Pack: 30 Pieces=549, 60 Pieces=999, 90 Pieces=1399
Huggies | Complete Comfort Taped Diapers | | Type: Taped Diapers; Protection: 12 hours | Pack: 24 Pieces=399, 50 Pieces=749
MamyPoko | Pants Extra Absorb Diaper Pants | | Type: Diaper Pants; Protection: 12 hours | Pack: 30 Pieces=499, 60 Pieces=949, 90 Pieces=1349
Himalaya | Total Care Baby Diaper Pants | | Type: Diaper Pants; Protection: 10 hours | Pack: 30 Pieces=449, 60 Pieces=849
Bella Baby | Happy Diaper Pants | | Type: Diaper Pants; Protection: 10 hours | Pack: 30 Pieces=399, 60 Pieces=749
Supples | Baby Diaper Pants | | Type: Diaper Pants; Protection: 10 hours | Pack: 30 Pieces=349, 60 Pieces=649
`;

const BABY_WIPES = `
Pampers | Fresh Clean Baby Wipes | | Type: Scented Wipes | Pack: 72 Wipes=199, 216 Wipes=549
Huggies | Nourish Baby Wipes | | Type: Aloe Vera Wipes | Pack: 72 Wipes=219, 216 Wipes=599
Himalaya | Gentle Baby Wipes | | Type: Aloe Vera Wipes | Pack: 72 Wipes=169, 216 Wipes=449
Mamaearth | Plant Based Water Baby Wipes | | Type: Water Wipes | Pack: 72 Wipes=199
Mother Sparsh | 99% Pure Water Baby Wipes | | Type: Water Wipes | Pack: 72 Wipes=249, 216 Wipes=699
Johnson's | Baby Skincare Wipes | | Type: Fragrance Free Wipes | Pack: 72 Wipes=199
Chicco | Soft Cleansing Baby Wipes | | Type: Fragrance Free Wipes | Pack: 72 Wipes=249
`;

const LINES: Line[] = [
  {
    category: "Men's T-Shirts",
    prefix: "Men",
    share: 7,
    items: "Round Neck T-Shirt 899, Polo T-Shirt 1299, V-Neck T-Shirt 899, Oversized T-Shirt 999, Henley T-Shirt 999",
    styles: "Solid, Printed, Striped, Typography Printed, Graphic Printed, Colourblocked",
    brands:
      "Roadster 0.7, Highlander 0.6, Bewakoof 0.6, The Souled Store 0.9, Allen Solly 1.1, U.S. Polo Assn. 1.4, Jack & Jones 1.3, Levi's 1.3, Tommy Hilfiger 2.8, Wrogn 1.1, H&M 0.8, Snitch 0.9, Peter England 0.9",
    colors:
      "Black, White, Navy Blue, Grey Melange, Maroon, Olive Green, Mustard, Red, Royal Blue, Teal, Beige, Lavender, Charcoal, Sky Blue",
    specs: "Fabric: Pure Cotton, Cotton Blend; Sleeve: Short Sleeves, Long Sleeves",
  },
  {
    category: "Men's T-Shirts",
    prefix: "Men",
    share: 3,
    items: "Training T-Shirt 1299, Running T-Shirt 1299, Polo T-Shirt 1499, Round Neck T-Shirt 999",
    styles: "Solid, Printed, Colourblocked, Striped, Self Design",
    brands: "Puma 1.3, Adidas 1.4, Nike 1.6, HRX 0.9, Reebok 1.1, Under Armour 1.9, ASICS 1.4",
    colors: "Black, White, Navy Blue, Grey, Red, Royal Blue, Olive Green, Charcoal, Teal",
    specs: "Fabric: Quick Dry Polyester, Cotton Blend; Sleeve: Short Sleeves, Sleeveless",
  },
  {
    category: "Men's Shirts",
    prefix: "Men",
    share: 10,
    items: "Casual Shirt 1499, Formal Shirt 1799, Party Shirt 1699",
    styles:
      "Slim Fit Checked, Regular Fit Solid, Slim Fit Striped, Regular Fit Printed, Slim Fit Solid, Tailored Fit Self Design, Regular Fit Checked, Slim Fit Printed",
    brands:
      "Peter England 1.0, Allen Solly 1.1, Van Heusen 1.2, Louis Philippe 1.6, Arrow 1.5, Raymond 1.2, Park Avenue 1.0, Roadster 0.7, Highlander 0.6, U.S. Polo Assn. 1.4, Levi's 1.3, Jack & Jones 1.3, Mufti 1.3, Tommy Hilfiger 2.5, Blackberrys 1.3, Snitch 0.9, Wrogn 1.0, Indian Terrain 1.2",
    colors:
      "White, Sky Blue, Light Blue, Navy Blue, Black, Pink, Grey, Olive Green, Maroon, Beige, Lavender, Green, Blue",
    specs:
      "Fabric: Pure Cotton, Cotton Blend, Linen Blend, Cotton Linen; Sleeve: Full Sleeves, Half Sleeves; Collar: Spread Collar, Button-Down Collar, Cutaway Collar",
  },
  {
    category: "Men's Jeans",
    prefix: "Men",
    share: 9,
    items: "Jeans 2299",
    styles:
      "Slim Fit Mid-Rise Stretchable, Skinny Fit Light Fade, Regular Fit Clean Look, Straight Fit Mid-Rise, Tapered Fit Heavy Fade, Relaxed Fit Clean Look, Slim Fit Distressed, Skinny Fit Mid-Rise Stretchable, Bootcut Mid-Rise",
    brands:
      "Levi's 1.4, Wrangler 1.2, Lee 1.2, Pepe Jeans 1.3, Spykar 1.0, Flying Machine 1.0, Jack & Jones 1.4, Mufti 1.3, Killer 1.0, Roadster 0.7, Highlander 0.6, U.S. Polo Assn. 1.3, Calvin Klein 2.8, Snitch 0.8, Lee Cooper 0.9",
    colors: "Blue, Navy Blue, Black, Grey, Light Blue, Charcoal, Dark Blue",
    specs:
      "Fabric: Cotton Blend Denim, Cotton Lycra Denim, Pure Cotton Denim; Shade: Light Shade, Mid Shade, Dark Shade",
  },
  {
    category: "Men's Trousers",
    prefix: "Men",
    share: 5,
    items: "Chinos 1999, Formal Trousers 2199, Cargo Trousers 1999, Joggers 1499",
    styles: "Slim Fit, Regular Fit, Tapered Fit, Relaxed Fit, Skinny Fit, Smart Fit",
    brands:
      "Allen Solly 1.1, Van Heusen 1.2, Peter England 1.0, Louis Philippe 1.5, Arrow 1.4, Raymond 1.2, Park Avenue 1.0, Highlander 0.6, Roadster 0.7, U.S. Polo Assn. 1.3, Jack & Jones 1.3, Mufti 1.2, Dennis Lingo 0.8",
    colors: "Black, Navy Blue, Beige, Khaki, Olive Green, Grey, Charcoal, Brown, Cream, Dark Green",
    specs: "Fabric: Cotton Blend, Pure Cotton, Polyester Viscose, Cotton Lycra",
  },
  {
    category: "Men's Kurtas",
    prefix: "Men",
    share: 4,
    items: "Kurta 1499, Kurta Pyjama Set 2499, Kurta with Churidar 2799, Nehru Jacket 2299",
    styles: "Embroidered, Solid, Printed, Jacquard Woven, Chikankari, Self Design, Thread Work, Ethnic Motifs",
    brands:
      "Fabindia 1.2, Vastramay 0.8, Jompers 0.6, House of Pataudi 1.0, Sojanya 0.9, Anouk 0.8, KISAH 0.8, Hangup 0.7, Manyavar 1.8, Tasva 1.6",
    colors:
      "Maroon, Cream, White, Navy Blue, Mustard, Peach, Sea Green, Black, Off White, Pink, Wine, Royal Blue, Beige",
    specs: "Fabric: Pure Cotton, Silk Blend, Art Silk, Linen Blend, Jacquard; Occasion: Festive, Wedding, Puja, Party",
  },
  {
    category: "Men's Kurtas",
    prefix: "Men",
    share: 2,
    items: "Sherwani Set 12999, Indo Western Sherwani 9999, Kurta Jacket Set 4999",
    styles: "Embroidered, Sequinned, Zari Work, Jacquard Woven, Velvet, Thread Work",
    brands:
      "Manyavar 1.8, Tasva 1.6, Ethnix by Raymond 1.3, Mohanlal Sons 2.0, Vastramay 0.8, House of Pataudi 1.0, Sojanya 0.9",
    colors: "Cream, Gold, Maroon, Off White, Beige, Navy Blue, Wine, Peach, Black, Royal Blue",
    specs: "Fabric: Silk Blend, Art Silk, Velvet, Jacquard; Occasion: Wedding, Reception, Sangeet",
  },
  {
    category: "Men's Shoes",
    prefix: "Men",
    share: 6,
    items: "Running Shoes 3999, Sneakers 3499, Walking Shoes 2999, Training Shoes 3499, Casual Shoes 2999",
    styles: "Lightweight, Mesh, Cushioned, Knitted, Colourblocked, Textured, Perforated, Solid",
    brands:
      "Nike 1.6, Adidas 1.4, Puma 1.1, Skechers 1.3, Reebok 1.0, ASICS 1.5, New Balance 1.7, Campus 0.5, Sparx 0.4, HRX 0.6, Asian 0.3, Red Tape 0.8",
    colors: "White, Black, Grey, Navy Blue, Blue, Red, Olive Green, Beige, Charcoal, Orange",
    specs: "Sole: EVA, Rubber, Phylon, PU; Closure: Lace-Up, Slip-On",
  },
  {
    category: "Men's Shoes",
    prefix: "Men",
    share: 4,
    items:
      "Formal Shoes 3499, Loafers 2999, Derby Shoes 3499, Oxford Shoes 3999, Chelsea Boots 4499, Casual Shoes 2999",
    styles: "Leather, Textured Leather, Suede, Patent Leather, Solid, Brogue",
    brands:
      "Red Tape 0.9, Bata 0.6, Woodland 1.1, Clarks 1.7, Hush Puppies 1.3, Liberty 0.5, U.S. Polo Assn. 0.9, Metro 0.8, Mochi 0.8, Lee Cooper 0.7, Bacca Bucci 0.6, Louis Philippe 1.2, Van Heusen 1.0",
    colors: "Black, Brown, Tan, Burgundy, Navy Blue, Grey, Coffee Brown",
    specs: "Sole: TPR, Rubber, Leather; Closure: Lace-Up, Slip-On",
  },
  {
    category: "Men's Slippers",
    prefix: "Men",
    share: 1,
    items: "Clogs 3499, Sandals 2999, Sliders 2499, Flip-Flops 1999",
    styles: "Classic, Solid, Printed, Lined, Textured",
    brands: "Crocs 1.0",
    colors: "Black, White, Navy Blue, Olive Green, Grey, Blue, Red",
    specs: "Material: Croslite; Closure: Slip-On, Back Strap",
  },
  {
    category: "Men's Slippers",
    prefix: "Men",
    share: 2,
    items: "Flip-Flops 599, Sliders 899, Sandals 1499",
    styles: "Solid, Printed, Textured, Lightweight, Comfort",
    brands:
      "Bata 0.8, Sparx 0.7, Adidas 1.8, Puma 1.4, Nike 2.0, Woodland 1.6, Red Tape 1.0, Campus 0.7, Paragon 0.4, Relaxo 0.35, Liberty 0.8",
    colors: "Black, Navy Blue, Brown, Grey, Blue, Olive Green, Tan",
    specs: "Material: EVA, Rubber, PU; Closure: Slip-On, Velcro",
  },
  {
    category: "Women's Kurtas",
    prefix: "Women",
    share: 8,
    items:
      "Kurta 1299, Straight Kurta 1199, Anarkali Kurta 1999, A-Line Kurta 1299, Kurti 899, Kurta with Trousers and Dupatta 2999, Kurta Set 2499",
    styles:
      "Floral Printed, Embroidered, Ethnic Motifs Printed, Chikankari, Yoke Design, Gotta Patti, Bandhani Printed, Solid, Mirror Work, Thread Work",
    brands:
      "Libas 1.0, W 1.2, Aurelia 0.9, Biba 1.3, Global Desi 1.2, Fabindia 1.2, Anouk 0.9, Rangriti 0.9, Sangria 0.9, Varanga 1.0, Jaipur Kurti 0.8, Khushal K 0.8, Soch 1.3, Indo Era 0.9, House of Pataudi 1.1, Vishudh 0.7, GoSriKi 0.8, Ishin 0.8",
    colors:
      "Pink, Blue, Navy Blue, Yellow, Green, Maroon, White, Off White, Peach, Mustard, Teal, Lavender, Red, Sea Green, Black, Beige",
    specs:
      "Fabric: Pure Cotton, Rayon, Viscose Rayon, Cotton Blend, Georgette, Chanderi Silk; Occasion: Daily Wear, Festive, Office, Party",
  },
  {
    category: "Sarees",
    prefix: "Women",
    share: 3,
    items: "Silk Saree 3999, Banarasi Saree 4999, Kanjeevaram Saree 7999, Paithani Saree 5999",
    styles: "Woven Design, Zari Border, Zari Woven, Temple Border, Brocade",
    brands:
      "Mitera 0.9, Saree Mall 0.8, Kalini 0.8, Satrani 0.8, Mimosa 0.9, Soch 1.4, Taneira 2.5, Kalamandir 1.8, Pothys 2.2, Nalli 2.6, Fabindia 1.6",
    colors: "Red, Maroon, Pink, Magenta, Gold, Green, Royal Blue, Purple, Mustard, Orange, Cream, Teal",
    specs: "Occasion: Wedding, Festive, Puja; Blouse: With Blouse Piece",
    itemSpecs: {
      "Silk Saree": "Fabric: Art Silk",
      "Banarasi Saree": "Fabric: Banarasi Silk; Occasion: Wedding",
      "Kanjeevaram Saree": "Fabric: Pure Silk; Occasion: Wedding",
      "Paithani Saree": "Fabric: Silk Blend",
    },
  },
  {
    category: "Sarees",
    prefix: "Women",
    share: 4,
    items:
      "Saree 1999, Georgette Saree 1999, Chiffon Saree 1799, Organza Saree 2499, Net Saree 2299, Cotton Saree 1499",
    styles: "Floral Printed, Embellished, Sequinned, Bandhani, Solid, Embroidered, Ombre, Leheriya",
    brands:
      "Mitera 0.9, Saree Mall 0.8, Sangria 1.0, Kalini 0.8, Anouk 1.0, Satrani 0.8, Ishin 0.8, Mimosa 0.9, Soch 1.4",
    colors:
      "Red, Maroon, Pink, Magenta, Green, Royal Blue, Navy Blue, Yellow, Mustard, Peach, Purple, Teal, Black, Lavender",
    specs: "Occasion: Party, Festive, Daily Wear, Office; Blouse: With Blouse Piece",
    itemSpecs: {
      Saree: "Fabric: Poly Silk",
      "Georgette Saree": "Fabric: Georgette",
      "Chiffon Saree": "Fabric: Chiffon",
      "Organza Saree": "Fabric: Organza",
      "Net Saree": "Fabric: Net",
      "Cotton Saree": "Fabric: Pure Cotton; Occasion: Daily Wear",
    },
  },
  {
    category: "Lehenga Cholis",
    prefix: "Women",
    share: 4,
    items:
      "Lehenga Choli 4999, Semi-Stitched Lehenga Choli 3499, Ready to Wear Lehenga Choli 3999, Bridal Lehenga Choli 14999, Party Wear Lehenga Choli 3999",
    styles: "Embroidered, Sequinned, Mirror Work, Zari Work, Gota Patti, Thread Work, Velvet, Foil Printed",
    brands:
      "Mohey 3.0, Biba 1.3, Soch 1.2, Kalini 0.8, Mitera 0.8, Inddus 1.0, Sangria 0.9, House of Pataudi 1.0, Ethnovog 1.1, Warthy Ent 0.7, Libas 1.0",
    colors: "Red, Maroon, Pink, Peach, Gold, Green, Royal Blue, Purple, Magenta, Wine, Sea Green, Lavender, Cream",
    specs:
      "Fabric: Silk Blend, Net, Georgette, Velvet, Art Silk; Dupatta: With Dupatta; Occasion: Wedding, Festive, Sangeet, Party",
    itemSpecs: { "Bridal Lehenga Choli": "Occasion: Wedding", "Party Wear Lehenga Choli": "Occasion: Party" },
  },
  {
    category: "Dresses",
    prefix: "Women",
    share: 8,
    items:
      "Maxi Dress 1999, Midi Dress 1799, A-Line Dress 1599, Bodycon Dress 1499, Fit and Flare Dress 1699, Wrap Dress 1799, Shirt Dress 1499, Sheath Dress 1599, Gown 2999",
    styles: "Party Wear, Floral Printed, Solid, Sequinned, Ruffled, Polka Dot Printed, Satin, Embellished, Self Design",
    brands:
      "Only 1.2, Vero Moda 1.3, AND 1.6, Forever New 2.8, SASSAFRAS 0.8, Tokyo Talkies 0.6, Berrylush 0.9, Harpa 0.8, FabAlley 1.0, StyleStone 0.6, Athena 0.9, Mast & Harbour 0.8, Dressberry 0.8, Zink London 1.3, Label Ritu Kumar 4.0, Lulu & Sky 1.3, Kazo 1.6, H&M 1.0, Mango 2.0",
    colors:
      "Black, Red, Navy Blue, Pink, White, Emerald Green, Maroon, Lavender, Yellow, Blue, Beige, Peach, Wine, Teal, Olive Green, Rust",
    specs:
      "Fabric: Polyester, Georgette, Crepe, Rayon, Cotton, Satin, Chiffon; Neck: Round Neck, V-Neck, Sweetheart Neck, Square Neck, Halter Neck, Off-Shoulder; Occasion: Party, Casual, Evening, Date Night",
  },
  {
    category: "Women's Tops",
    prefix: "Women",
    share: 5,
    items: "Top 999, Crop Top 899, Shirt 1299, T-Shirt 799, Peplum Top 1099, Tunic 1099, Blouson Top 999",
    styles: "Solid, Floral Printed, Striped, Ruffled, Puff Sleeves, Smocked, Self Design, Checked, Embroidered",
    brands:
      "Tokyo Talkies 0.6, H&M 0.9, Only 1.2, Vero Moda 1.3, Roadster 0.7, Dressberry 0.8, Harpa 0.8, SASSAFRAS 0.8, Mast & Harbour 0.8, Berrylush 0.9, Marks & Spencer 1.5, FabAlley 1.0, Trendyol 1.1, StyleCast 0.8, Levi's 1.2",
    colors:
      "White, Black, Pink, Lavender, Yellow, Sky Blue, Red, Olive Green, Peach, Mint Green, Navy Blue, Beige, Maroon, Rust",
    specs:
      "Fabric: Pure Cotton, Rayon, Polyester, Cotton Blend, Georgette; Sleeve: Short Sleeves, Long Sleeves, Sleeveless, Three-Quarter Sleeves",
  },
  {
    category: "Women's Tops",
    prefix: "Women",
    share: 1,
    items: "T-Shirt 999, Training T-Shirt 1299, Tank Top 899",
    styles: "Solid, Printed, Colourblocked, Typography Printed",
    brands: "Puma 1.3, Adidas 1.4, Nike 1.6, HRX 0.8, Reebok 1.1",
    colors: "Black, White, Pink, Lavender, Grey, Navy Blue, Peach, Mint Green",
    specs: "Fabric: Quick Dry Polyester, Cotton Blend; Sleeve: Short Sleeves, Sleeveless",
  },
  {
    category: "Women's Jeans",
    prefix: "Women",
    share: 5,
    items: "Jeans 2199",
    styles:
      "Skinny Fit High-Rise Stretchable, Straight Fit High-Rise, Wide Leg High-Rise, Mom Fit High-Rise, Bootcut Mid-Rise, Slim Fit Mid-Rise Clean Look, Flared High-Rise, Boyfriend Fit Light Fade",
    brands:
      "Levi's 1.4, Only 1.2, Vero Moda 1.2, Roadster 0.7, Mast & Harbour 0.7, H&M 0.9, Pepe Jeans 1.3, Lee 1.2, Wrangler 1.1, Spykar 1.0, Dressberry 0.8, Kotty 0.6, Kraus Jeans 0.8, AND 1.4",
    colors: "Blue, Light Blue, Navy Blue, Black, Grey, White, Dark Blue, Ice Blue",
    specs:
      "Fabric: Cotton Lycra Denim, Cotton Blend Denim, Pure Cotton Denim; Shade: Light Shade, Mid Shade, Dark Shade",
  },
  {
    category: "Women's Sandals",
    prefix: "Women",
    share: 4,
    items: "Heels 1799, Block Heels 1899, Wedges 1999, Flats 1299, Stilettos 2299, Sandals 1299",
    styles: "Embellished, Solid, Strappy, Textured, Party, Open Toe, Ankle Strap",
    brands:
      "Metro 1.0, Mochi 1.0, Inc.5 1.1, Catwalk 1.0, Bata 0.7, Rocia 0.9, Carlton London 1.3, Marc Loire 0.9, Steve Madden 2.5, Aldo 2.8, Clarks 2.2, Shoetopia 0.5, Dressberry 0.7, Flat n Heels 0.6, Mast & Harbour 0.7, Liberty 0.6",
    colors: "Black, Gold, Silver, Tan, Nude, Pink, Red, White, Beige, Rose Gold, Maroon, Peach",
    specs: "Sole: TPR, PU, Rubber; Closure: Buckle, Slip-On, Velcro, Ankle Loop",
  },
  {
    category: "Women's Sandals",
    prefix: "Women",
    share: 1,
    items: "Juttis 1199, Kolhapuris 999, Mojaris 1299",
    styles: "Embroidered, Embellished, Mirror Work, Ethnic, Solid",
    brands: "Mochi 1.0, Metro 1.0, Fabindia 1.2, Shoetopia 0.5, Flat n Heels 0.6, Dressberry 0.7",
    colors: "Gold, Silver, Tan, Maroon, Pink, Black, Red, Beige",
    specs: "Sole: TPR, Leather; Closure: Slip-On",
  },
  {
    category: "Women's Shoes",
    prefix: "Women",
    share: 3,
    items: "Running Shoes 3499, Sneakers 2999, Walking Shoes 2799, Training Shoes 3299",
    styles: "Lightweight, Mesh, Cushioned, Knitted, Colourblocked, Textured, Solid, Perforated",
    brands: "Nike 1.6, Adidas 1.4, Puma 1.1, Skechers 1.3, Reebok 1.0, ASICS 1.5, Campus 0.5, HRX 0.6, Red Tape 0.8",
    colors: "White, Black, Pink, Grey, Lavender, Peach, Blue, Beige, Mint Green, Navy Blue, Red, Maroon",
    specs: "Sole: EVA, Rubber, Phylon; Closure: Lace-Up, Slip-On",
  },
  {
    category: "Women's Shoes",
    prefix: "Women",
    share: 1,
    items: "Sneakers 2499, Casual Shoes 2299, Ballerinas 1499, Loafers 1999",
    styles: "Solid, Textured, Embellished, Perforated, Quilted",
    brands:
      "Roadster 0.6, Dressberry 0.6, Mast & Harbour 0.6, Bata 0.6, Mochi 0.8, Metro 0.8, Carlton London 1.0, Steve Madden 2.0",
    colors: "White, Black, Pink, Beige, Tan, Gold, Silver, Peach",
    specs: "Sole: TPR, Rubber, PU; Closure: Lace-Up, Slip-On",
  },
  {
    category: "Boys Clothing",
    prefix: "Boys",
    share: 1,
    items: "T-Shirt 599, Shirt 899, Clothing Set 999",
    styles: "Printed, Solid, Striped, Checked, Graphic Printed, Colourblocked",
    brands:
      "Allen Solly Junior 1.2, U.S. Polo Assn. 1.4, Gini & Jony 1.0, Babyhug 0.8, H&M 0.9, Max 0.7, YK 0.7, Pantaloons Junior 0.8, Peter England 1.0, Hopscotch 0.8, Mothercare 1.1, Jack & Jones 1.2",
    colors: "Navy Blue, Black, White, Red, Grey, Blue, Green, Yellow, Olive Green, Maroon, Orange",
    specs: "Fabric: Pure Cotton, Cotton Blend",
  },
  {
    category: "Boys Clothing",
    prefix: "Boys",
    share: 1,
    items: "Jeans 1199, Shorts 599, Track Pants 799, Joggers 799",
    styles: "Solid, Slim Fit, Regular Fit, Washed",
    brands:
      "Allen Solly Junior 1.2, U.S. Polo Assn. 1.4, Gini & Jony 1.0, Babyhug 0.8, H&M 0.9, Max 0.7, YK 0.7, Pantaloons Junior 0.8, Hopscotch 0.8, Jack & Jones 1.2",
    colors: "Navy Blue, Black, Blue, Grey, Olive Green, Charcoal, Light Blue",
    specs: "Fabric: Pure Cotton, Cotton Blend, Denim",
  },
  {
    category: "Boys Clothing",
    prefix: "Boys",
    share: 1,
    items: "Kurta Pyjama Set 1299, Sherwani Set 2999, Kurta with Nehru Jacket Set 1999",
    styles: "Embroidered, Solid, Printed, Jacquard Woven, Self Design",
    brands: "Vastramay 0.8, Jompers 0.6, Manyavar 1.6, Sojanya 0.8, Fabindia 1.1",
    colors: "Cream, Maroon, Navy Blue, White, Mustard, Peach, Gold, Sea Green",
    specs: "Fabric: Pure Cotton, Silk Blend, Art Silk; Occasion: Festive, Wedding, Party",
  },
  {
    category: "Girls Clothing",
    prefix: "Girls",
    share: 1,
    items: "Frock 999, Dress 1199, Skirt 699, Party Gown 1499",
    styles: "Floral Printed, Solid, Embellished, Polka Dot, Ruffled, Tiered, Sequinned",
    brands:
      "Gini & Jony 1.0, Babyhug 0.8, H&M 0.9, Max 0.7, YK 0.7, Hopscotch 0.8, Peppermint 0.7, Cutecumber 1.1, Naughty Ninos 1.3, Mothercare 1.1, Allen Solly Junior 1.2, Pantaloons Junior 0.8",
    colors: "Pink, Peach, White, Lavender, Red, Yellow, Blue, Mint Green, Purple, Navy Blue",
    specs: "Fabric: Pure Cotton, Cotton Blend, Polyester, Net; Occasion: Party, Casual, Birthday",
  },
  {
    category: "Girls Clothing",
    prefix: "Girls",
    share: 1,
    items: "Top 599, T-Shirt 499, Jeans 1099, Leggings 499, Shorts 499",
    styles: "Solid, Printed, Striped, Graphic Printed",
    brands:
      "Gini & Jony 1.0, Babyhug 0.8, H&M 0.9, Max 0.7, YK 0.7, Hopscotch 0.8, Peppermint 0.7, Mothercare 1.1, Allen Solly Junior 1.2, Pantaloons Junior 0.8",
    colors: "Pink, Peach, White, Lavender, Red, Yellow, Blue, Mint Green, Purple, Navy Blue, Black",
    specs: "Fabric: Pure Cotton, Cotton Blend",
  },
  {
    category: "Girls Clothing",
    prefix: "Girls",
    share: 1,
    items: "Lehenga Choli 1999, Ethnic Gown 1799, Kurta with Sharara 1499, Pattu Pavadai 1999",
    styles: "Embroidered, Sequinned, Zari Work, Floral Printed, Mirror Work",
    brands: "Biba 1.2, Aarika 0.8, Cutecumber 1.0, Ethnovog 1.0, Sangria 0.9",
    colors: "Pink, Peach, Red, Maroon, Gold, Lavender, Yellow, Green",
    specs: "Fabric: Silk Blend, Net, Georgette, Art Silk; Occasion: Festive, Wedding, Party",
  },
];

// Clothes and footwear built from a brand line: brand + style + colour + item, priced by the brand's tier.
function fashion(line: Line, count: number, random: () => number, usedNames: Set<string>): Model[] {
  // One random value of the list.
  const pick = <T>(values: T[]) => values[Math.floor(random() * values.length)];
  const itemPrices = pairs(line.items);
  const brands = pairs(line.brands);
  const styles = list(line.styles);
  const colors = list(line.colors);
  const choices = Object.entries(specsOf(line.specs)).map(([key, values]) => [key, list(values)] as const);
  const models: Model[] = [];

  for (let tries = 0; models.length < count && tries < count * 50; tries++) {
    const [brand, factor] = pick(brands);
    const [item, base] = pick(itemPrices);
    const color = pick(colors);
    const name = `${brand} ${line.prefix} ${color} ${pick(styles)} ${item}`;
    if (usedNames.has(name)) continue;
    usedNames.add(name);
    models.push({
      category: line.category,
      brand,
      name,
      price: priceOf(base * factor * (0.85 + random() * 0.35)),
      colors: [color],
      specs: {
        ...Object.fromEntries(choices.map(([key, values]) => [key, pick(values)])),
        ...specsOf(line.itemSpecs?.[item] ?? ""),
      },
    });
  }
  return models;
}

// All demo products: the real-model tables first, then fashion lines to fill up to `total`, with descriptions.
export function buildCatalog(total: number, random: () => number): CatalogProduct[] {
  const models = [
    ...phones("Smartphones", PHONES),
    ...phones("Tablets", TABLETS),
    ...laptops("Everyday Laptops", LAPTOPS),
    ...laptops("Gaming Laptops", GAMING_LAPTOPS),
    ...goods("Power Banks", POWER_BANKS),
    ...goods("Headphones", HEADPHONES),
    ...goods("Smart Watches", SMART_WATCHES),
    ...goods("Lipsticks", LIPSTICKS),
    ...goods("Eye Makeup", EYE_MAKEUP),
    ...goods("Skin Care", SKIN_CARE),
    ...goods("Staples", STAPLES),
    ...goods("Oils & Ghee", OILS),
    ...goods("Tea & Coffee", TEA_COFFEE),
    ...goods("Snacks", SNACKS),
    ...goods("Trolley Bags", TROLLEY_BAGS),
    ...goods("Backpacks", BACKPACKS),
    ...goods("Travel Accessories", TRAVEL_ACCESSORIES),
    ...goods("Lighting", LIGHTING),
    ...goods("Kitchen", KITCHEN),
    ...goods("Diapers", DIAPERS),
    ...goods("Baby Wipes", BABY_WIPES),
  ];
  const usedNames = new Set(models.map((model) => model.name));
  const left = total - models.length;
  const shares = LINES.reduce((sum, line) => sum + line.share, 0);
  let planned = 0;
  LINES.forEach((line, index) => {
    let count = Math.round((left * line.share) / shares);
    if (index === LINES.length - 1) count = left - planned;
    planned += count;
    models.push(...fashion(line, count, random, usedNames));
  });
  for (const line of LINES) {
    if (models.length >= total) break;
    models.push(...fashion(line, total - models.length, random, usedNames));
  }

  const categoryOf = new Map(
    CATEGORIES.flatMap((parent) =>
      parent.children.map((child) => [child.name, { ...child, discount: parent.discount }]),
    ),
  );
  return models.map((model) => {
    const category = categoryOf.get(model.category)!;
    const someSizes = (category.sizes ?? []).filter(() => random() < 0.85);
    const sizes = someSizes.length > 0 ? someSizes : (category.sizes ?? []);
    const details = Object.entries(model.specs).map(([key, value]) => `${key}: ${value}`);
    return {
      ...model,
      sizes,
      gender: category.gender ?? null,
      ageGroup: category.ageGroup ?? null,
      discount: category.discount,
      description: [
        category.about,
        `${details.join(", ")}.`,
        model.colors.length > 0 ? `Colours: ${model.colors.join(", ")}.` : "",
        sizes.length > 0 ? `Sizes: ${sizes.join(", ")}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    };
  });
}
