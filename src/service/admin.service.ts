import { OrderStatus, Prisma, Role } from "@prisma/client";
import { lockProduct, prisma } from "../config/db";
import { clearCache } from "../config/redis";
import { AppError } from "../utils/appError";
import { pageQuery, paginate } from "../utils/paginate";
import { finalPrice } from "../utils/price";
import { titleCase } from "../utils/text";
import { tokenService } from "./token.service";

type ProductInput = {
  name: string;
  slug: string;
  description: string;
  pricePaise: number;
  discountPercent: number;
  stock: number;
  categoryId: string;
  brandId?: string | null;
  colors?: string[];
  sizes?: string[];
  gender?: string | null;
  ageGroup?: string | null;
  specs?: Record<string, string> | null;
  offerEndsAt?: Date | null;
  isTrending?: boolean;
  isFeatured?: boolean;
};

type Admin = { userId: string; role: Role };

const EMBEDDING_FIELDS = [
  "name",
  "description",
  "brandId",
  "categoryId",
  "colors",
  "sizes",
  "gender",
  "ageGroup",
  "specs",
] as const;

// The database row for a new product, with sellPaise worked out from price and discount.
function toProductData(product: ProductInput, images: string[]) {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description,
    pricePaise: product.pricePaise,
    discountPercent: product.discountPercent,
    sellPaise: finalPrice(product.pricePaise, product.discountPercent, product.offerEndsAt),
    offerEndsAt: product.offerEndsAt,
    stock: product.stock,
    categoryId: product.categoryId,
    brandId: product.brandId,
    colors: (product.colors ?? []).map(titleCase),
    sizes: product.sizes ?? [],
    gender: product.gender,
    ageGroup: product.ageGroup,
    specs: product.specs ?? Prisma.DbNull,
    isTrending: product.isTrending ?? false,
    isFeatured: product.isFeatured ?? false,
    images,
  };
}

// Throws unless the parent exists and is a top-level category (only two levels are allowed).
async function checkParentCategory(parentId: string) {
  const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { parentId: true } });
  if (!parent) throw new AppError("Parent category not found", 404);
  if (parent.parentId) throw new AppError("Subcategory cannot have its own subcategory", 400);
}

// Throws when the admin may not block or change this user (self, super admin, or another admin for a normal admin).
async function checkCanChangeUser(admin: Admin, userId: string) {
  if (userId === admin.userId) throw new AppError("You cannot do this on your own account", 400);
  const user = await prisma.user.findFirst({ where: { id: userId, isDeleted: false }, select: { role: true } });
  if (!user) throw new AppError("User not found", 404);
  if (user.role === "SUPER_ADMIN") throw new AppError("Super admin account cannot be changed", 403);
  if (user.role === "ADMIN" && admin.role !== "SUPER_ADMIN") {
    throw new AppError("Only a super admin can manage an admin", 403);
  }
}

export const adminService = {
  // Throws 409 when another product already uses the slug.
  async checkSlugFree(slug: string) {
    const taken = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (taken) throw new AppError("Slug already in use", 409);
  },

  // Throws 404 when the product does not exist (checked before uploading images).
  async checkProductExists(id: string) {
    const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) throw new AppError("Product not found", 404);
  },

  // Creates a product; at least one image is required.
  async createProduct(data: ProductInput, images: string[]) {
    if (images.length === 0) throw new AppError("At least one product image required", 400);
    const product = await prisma.product.create({ data: toProductData(data, images) });
    await clearCache();
    return product;
  },

  // Creates many products at once; slugs that already exist are skipped and returned.
  async bulkCreateProducts(products: (ProductInput & { images: string[] })[]) {
    const slugs = products.map((product) => product.slug);
    if (new Set(slugs).size !== slugs.length) {
      throw new AppError("Duplicate slugs in the uploaded list", 400);
    }

    const categoryIds = [...new Set(products.map((product) => product.categoryId))];
    const brandIds: string[] = [];
    for (const product of products) {
      if (product.brandId && !brandIds.includes(product.brandId)) brandIds.push(product.brandId);
    }
    const [categoryCount, brandCount, existing] = await Promise.all([
      prisma.category.count({ where: { id: { in: categoryIds } } }),
      prisma.brand.count({ where: { id: { in: brandIds } } }),
      prisma.product.findMany({ where: { slug: { in: slugs } }, select: { slug: true } }),
    ]);
    if (categoryCount !== categoryIds.length) {
      throw new AppError("One or more categoryId not found", 400);
    }
    if (brandCount !== brandIds.length) throw new AppError("One or more brandId not found", 400);

    const skipped = existing.map((product) => product.slug);
    const toCreate = products.filter((product) => !skipped.includes(product.slug));
    if (toCreate.length > 0) {
      const rows = toCreate.map((product) => toProductData(product, product.images));
      await prisma.product.createMany({ data: rows });
      await clearCache();
    }
    return { created: toCreate.length, skipped };
  },

  // Changes a product, works out sellPaise again, and clears the embedding when its text changed.
  async updateProduct(id: string, data: Partial<ProductInput> & { isActive?: boolean }, newImages: string[]) {
    const product = await prisma.$transaction(async (db) => {
      await lockProduct(db, id);
      const current = await db.product.findUnique({
        where: { id },
        select: { pricePaise: true, discountPercent: true, offerEndsAt: true },
      });
      if (!current) throw new AppError("Product not found", 404);

      const { pricePaise: newPrice, brandId, categoryId, colors, specs, ...rest } = data;
      const pricePaise = newPrice ?? current.pricePaise;
      const discountPercent = data.discountPercent ?? current.discountPercent;
      const offerEndsAt = data.offerEndsAt !== undefined ? data.offerEndsAt : current.offerEndsAt;
      const brandChange = brandId ? { connect: { id: brandId } } : { disconnect: true };

      const updated = await db.product.update({
        where: { id },
        data: {
          ...rest,
          pricePaise,
          sellPaise: finalPrice(pricePaise, discountPercent, offerEndsAt),
          ...(colors !== undefined && { colors: colors.map(titleCase) }),
          ...(specs !== undefined && { specs: specs ?? Prisma.DbNull }),
          ...(categoryId && { category: { connect: { id: categoryId } } }),
          ...(brandId !== undefined && { brand: brandChange }),
          ...(newImages.length > 0 && { images: newImages }),
        },
      });
      if (EMBEDDING_FIELDS.some((field) => data[field] !== undefined)) {
        await db.$executeRaw`UPDATE "Product" SET "embedding" = NULL WHERE "id" = ${id}`;
      }
      return updated;
    });
    await clearCache();
    return product;
  },

  // Sets one discount (and end date) on every product, or on one category and its subcategories.
  async applySale(data: { categoryId?: string; discountPercent: number; offerEndsAt?: Date | null }) {
    const percent = data.discountPercent;
    const offerEndsAt = percent > 0 ? (data.offerEndsAt ?? null) : null;

    let onlyThese = Prisma.empty;
    if (data.categoryId) {
      const categories = await prisma.category.findMany({
        where: { OR: [{ id: data.categoryId }, { parentId: data.categoryId }] },
        select: { id: true },
      });
      if (categories.length === 0) throw new AppError("Category not found", 404);
      onlyThese = Prisma.sql`WHERE "categoryId" IN (${Prisma.join(categories.map((category) => category.id))})`;
    }

    const updated = await prisma.$executeRaw`
      UPDATE "Product" SET
        "discountPercent" = ${percent},
        "offerEndsAt" = ${offerEndsAt},
        "sellPaise" = "pricePaise" - ROUND("pricePaise" * ${percent} / 10000.0) * 100,
        "updatedAt" = NOW()
      ${onlyThese}`;
    await clearCache();
    return { updated };
  },

  // Hides a product from shoppers (products are never deleted).
  async hideProduct(id: string) {
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    await clearCache();
  },

  // One product with every field the edit form needs.
  async getProduct(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        pricePaise: true,
        discountPercent: true,
        offerEndsAt: true,
        stock: true,
        colors: true,
        sizes: true,
        gender: true,
        ageGroup: true,
        specs: true,
        images: true,
        categoryId: true,
        brandId: true,
        isActive: true,
        isTrending: true,
        isFeatured: true,
      },
    });
    if (!product) throw new AppError("Product not found", 404);
    return product;
  },

  // All products, newest first, searchable by name, with the quantity held by unpaid orders.
  async listProducts(query: { q?: string; cursor?: string; limit: number }) {
    const rows = await prisma.product.findMany({
      where: query.q ? { name: { contains: query.q, mode: "insensitive" } } : {},
      select: {
        id: true,
        name: true,
        slug: true,
        pricePaise: true,
        stock: true,
        isActive: true,
        isTrending: true,
        isFeatured: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageQuery(query.cursor, query.limit),
    });
    const page = paginate(rows, query.limit);

    const held = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { in: page.items.map((product) => product.id) }, order: { status: "PENDING" } },
      _sum: { quantity: true },
    });
    const items = page.items.map((product) => ({
      ...product,
      reservedQuantity: held.find((row) => row.productId === product.id)?._sum.quantity ?? 0,
    }));
    return { items, nextCursor: page.nextCursor };
  },

  // Every category with its subcategories, hidden ones too.
  async listCategories() {
    return prisma.category.findMany({
      where: { parentId: null },
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        isActive: true,
        children: {
          select: { id: true, name: true, slug: true, image: true, isActive: true },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });
  },

  // Creates a category, or a subcategory when parentId is given.
  async createCategory(data: { name: string; slug: string; parentId?: string }, image?: string) {
    if (data.parentId) await checkParentCategory(data.parentId);
    const category = await prisma.category.create({ data: { ...data, image } });
    await clearCache();
    return category;
  },

  // Changes a category; a rename or move clears the embeddings of its products.
  async updateCategory(
    id: string,
    data: { name?: string; slug?: string; parentId?: string | null; isActive?: boolean },
    image?: string,
  ) {
    if (data.parentId) {
      if (data.parentId === id) throw new AppError("Category cannot be its own parent", 400);
      await checkParentCategory(data.parentId);
      const children = await prisma.category.count({ where: { parentId: id } });
      if (children > 0) {
        throw new AppError("Category with subcategories cannot become a subcategory", 400);
      }
    }

    const category = await prisma.category.update({ where: { id }, data: { ...data, ...(image && { image }) } });
    if (data.name !== undefined || data.parentId !== undefined) {
      await prisma.$executeRaw`
        UPDATE "Product" SET "embedding" = NULL
        WHERE "categoryId" IN (SELECT "id" FROM "Category" WHERE "id" = ${id} OR "parentId" = ${id})`;
    }
    await clearCache();
    return category;
  },

  // Deletes a category that has no products and no subcategories.
  async deleteCategory(id: string) {
    const [products, children] = await Promise.all([
      prisma.product.count({ where: { categoryId: id } }),
      prisma.category.count({ where: { parentId: id } }),
    ]);
    if (products > 0) throw new AppError("Category has products, cannot delete", 409);
    if (children > 0) throw new AppError("Category has subcategories, cannot delete", 409);
    await prisma.category.delete({ where: { id } });
    await clearCache();
  },

  // Every brand, hidden ones too.
  async listBrands() {
    return prisma.brand.findMany({
      select: { id: true, name: true, slug: true, logo: true, isActive: true },
      orderBy: { name: "asc" },
    });
  },

  // Creates a brand.
  async createBrand(data: { name: string; slug: string }, logo?: string) {
    const brand = await prisma.brand.create({ data: { ...data, logo } });
    await clearCache();
    return brand;
  },

  // Renames, hides or shows a brand; a rename clears the embeddings of its products.
  async updateBrand(id: string, data: { name?: string; isActive?: boolean }) {
    const brand = await prisma.brand.update({ where: { id }, data });
    if (data.name !== undefined) {
      await prisma.$executeRaw`UPDATE "Product" SET "embedding" = NULL WHERE "brandId" = ${id}`;
    }
    await clearCache();
    return brand;
  },

  // Deletes a brand that has no products.
  async deleteBrand(id: string) {
    const products = await prisma.product.count({ where: { brandId: id } });
    if (products > 0) {
      throw new AppError(`Brand has ${products} product(s), cannot delete. Remove brand from products first.`, 409);
    }
    await prisma.brand.delete({ where: { id } });
    await clearCache();
  },

  // Every home page banner in display order.
  async listBanners() {
    return prisma.banner.findMany({
      select: { id: true, image: true, link: true, position: true, isActive: true },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    });
  },

  // Creates a home page banner.
  async createBanner(data: { link?: string; position: number }, image: string) {
    const banner = await prisma.banner.create({ data: { ...data, image } });
    await clearCache();
    return banner;
  },

  // Changes a banner's link, position or visibility.
  async updateBanner(id: string, data: { link?: string | null; position?: number; isActive?: boolean }) {
    const banner = await prisma.banner.update({ where: { id }, data });
    await clearCache();
    return banner;
  },

  // Deletes a banner.
  async deleteBanner(id: string) {
    await prisma.banner.delete({ where: { id } });
    await clearCache();
  },

  // Today's paid orders and revenue (India time), and counts of orders waiting for payment, shipping or review.
  async getStats() {
    const indiaOffsetMs = 330 * 60 * 1000;
    const indiaToday = new Date(Date.now() + indiaOffsetMs);
    indiaToday.setUTCHours(0, 0, 0, 0);
    const startOfDay = new Date(indiaToday.getTime() - indiaOffsetMs);

    const [today, awaitingPayment, toShip, needsReview] = await Promise.all([
      prisma.order.aggregate({
        where: { createdAt: { gte: startOfDay }, status: { in: ["CONFIRMED", "SHIPPED", "DELIVERED"] } },
        _count: true,
        _sum: { totalPaise: true },
      }),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.count({ where: { status: "CONFIRMED" } }),
      prisma.order.count({ where: { needsReview: true } }),
    ]);

    return {
      ordersToday: today._count,
      revenueTodayPaise: today._sum.totalPaise ?? 0,
      awaitingPayment,
      toShip,
      needsReview,
    };
  },

  // All orders, newest first, filtered by status or "needs review".
  async listOrders(query: { status?: OrderStatus; needsReview?: boolean; cursor?: string; limit: number }) {
    const rows = await prisma.order.findMany({
      where: {
        ...(query.status && { status: query.status }),
        ...(query.needsReview !== undefined && { needsReview: query.needsReview }),
      },
      select: {
        id: true,
        totalPaise: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        needsReview: true,
        cancelledBy: true,
        createdAt: true,
        shipName: true,
        shipPhone: true,
        shipLine1: true,
        shipLine2: true,
        shipCity: true,
        shipState: true,
        shipPincode: true,
        items: { select: { productName: true, quantity: true, size: true, color: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageQuery(query.cursor, query.limit),
    });
    return paginate(rows, query.limit);
  },

  // Customers, newest first, searchable by phone.
  async listUsers(query: { q?: string; cursor?: string; limit: number }) {
    const rows = await prisma.user.findMany({
      where: { isDeleted: false, ...(query.q && { phone: { contains: query.q } }) },
      select: { id: true, phone: true, name: true, email: true, role: true, isBlocked: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageQuery(query.cursor, query.limit),
    });
    return paginate(rows, query.limit);
  },

  // Blocks or unblocks a user; blocking logs them out everywhere.
  async setUserBlock(admin: Admin, userId: string, isBlocked: boolean) {
    await checkCanChangeUser(admin, userId);
    await prisma.user.update({ where: { id: userId }, data: { isBlocked } });
    if (isBlocked) await tokenService.logoutAllDevices(userId);
  },

  // Makes a user an admin or a normal user, and logs them out everywhere.
  async setUserRole(admin: Admin, userId: string, role: "USER" | "ADMIN") {
    await checkCanChangeUser(admin, userId);
    await prisma.user.update({ where: { id: userId }, data: { role } });
    await tokenService.logoutAllDevices(userId);
  },
};
