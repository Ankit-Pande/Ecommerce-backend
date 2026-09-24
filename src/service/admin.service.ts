import { OrderStatus, Role } from "@prisma/client";
import { prisma } from "../config/db";
import { AppError } from "../utils/appError";
import { bumpStorefrontCache } from "../config/cache";
import { paginate } from "../utils/paginate";
import { finalPrice, LOW_STOCK_AT } from "../utils/price";
import { titleCase } from "../utils/text";
import { tokenService } from "./token.service";
import { userService } from "./user.service";

type ProductInput = {
  name: string;
  slug: string;
  description: string;
  pricePaise: number;
  discountPercent: number;
  stock: number;
  categoryId: string;
  brandId?: string | null;
  color?: string | null;
  gender?: string | null;
  ageGroup?: string | null;
  offerEndsAt?: Date | null;
  isTrending?: boolean;
  isFeatured?: boolean;
};

type Actor = { userId: string; role: Role };

// Single aur bulk dono isi se DB row banate hain.
function productRow(p: ProductInput, images: string[]) {
  return {
    name: p.name,
    slug: p.slug,
    description: p.description,
    pricePaise: p.pricePaise,
    discountPercent: p.discountPercent,
    sellPaise: finalPrice(p.pricePaise, p.discountPercent, p.offerEndsAt),
    offerEndsAt: p.offerEndsAt,
    stock: p.stock,
    categoryId: p.categoryId,
    brandId: p.brandId,
    color: p.color ? titleCase(p.color) : null,
    gender: p.gender,
    ageGroup: p.ageGroup,
    isTrending: p.isTrending ?? false,
    isFeatured: p.isFeatured ?? false,
    images,
  };
}

// Tree sirf 2 level: parent khud top-level hona chahiye.
async function checkParent(parentId: string) {
  const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { parentId: true } });
  if (!parent) throw new AppError("Parent category not found", 404);
  if (parent.parentId) throw new AppError("Subcategory cannot have its own subcategory", 400);
}

// Super admin ko koi nahi chhoo sakta; admin ko sirf super admin; khud par bhi nahi.
async function checkCanManage(actor: Actor, userId: string) {
  if (userId === actor.userId) throw new AppError("You cannot do this on your own account", 400);
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
    select: { role: true },
  });
  if (!user) throw new AppError("User not found", 404);
  if (user.role === "SUPER_ADMIN") throw new AppError("Super admin account cannot be changed", 403);
  if (user.role === "ADMIN" && actor.role !== "SUPER_ADMIN") {
    throw new AppError("Only a super admin can manage an admin", 403);
  }
}

export const adminService = {
  // ---------- Product ----------
  // Image upload mehnga hai — controller upload se pehle slug check karta hai.
  async checkSlugFree(slug: string) {
    const taken = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (taken) throw new AppError("Slug already in use", 409);
  },

  // Sirf "hai ya nahi" — poora row padhne ki zaroorat nahi.
  async checkProductExists(id: string) {
    const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) throw new AppError("Product not found", 404);
  },

  async createProduct(data: ProductInput, images: string[]) {
    if (images.length === 0) throw new AppError("At least one product image required", 400);
    const product = await prisma.product.create({ data: productRow(data, images) });
    await bumpStorefrontCache();
    return product;
  },

  // Max 50. Jo slug pehle se hai wo chhod dete hain (dobara upload safe) aur report me batate hain.
  async bulkCreateProducts(products: (ProductInput & { images: string[] })[]) {
    const slugs = products.map((p) => p.slug);
    if (new Set(slugs).size !== slugs.length) throw new AppError("Duplicate slugs in the uploaded list", 400);

    // Galat category/brand id pe aadha data na bane — pehle hi rok do.
    const categoryIds = [...new Set(products.map((p) => p.categoryId))];
    const brandIds = [...new Set(products.map((p) => p.brandId).filter((id): id is string => !!id))];
    const [categoryCount, brandCount, existing] = await Promise.all([
      prisma.category.count({ where: { id: { in: categoryIds } } }),
      prisma.brand.count({ where: { id: { in: brandIds } } }),
      prisma.product.findMany({ where: { slug: { in: slugs } }, select: { slug: true } }),
    ]);
    if (categoryCount !== categoryIds.length) throw new AppError("One or more categoryId not found", 400);
    if (brandCount !== brandIds.length) throw new AppError("One or more brandId not found", 400);

    const skipped = existing.map((p) => p.slug);
    const toCreate = products.filter((p) => !skipped.includes(p.slug));
    if (toCreate.length > 0) {
      await prisma.product.createMany({ data: toCreate.map((p) => productRow(p, p.images)) });
      await bumpStorefrontCache();
    }
    return { created: toCreate.length, skipped };
  },

  // Sirf bheje gaye fields badlte hain. Nayi images aayi to purani ki jagah.
  async updateProduct(id: string, data: Partial<ProductInput> & { isActive?: boolean }, newImages: string[]) {
    const product = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${id} FOR UPDATE`;
      const old = await tx.product.findUnique({
        where: { id },
        select: { pricePaise: true, discountPercent: true, offerEndsAt: true },
      });
      if (!old) throw new AppError("Product not found", 404);

      const { pricePaise: newPrice, brandId, categoryId, color, ...rest } = data;
      const pricePaise = newPrice ?? old.pricePaise;
      const discountPercent = data.discountPercent ?? old.discountPercent;
      const offerEndsAt = data.offerEndsAt !== undefined ? data.offerEndsAt : old.offerEndsAt;

      return tx.product.update({
        where: { id },
        data: {
          ...rest,
          pricePaise,
          // Price/discount/deadline me kuch bhi badle, sale price dobara.
          sellPaise: finalPrice(pricePaise, discountPercent, offerEndsAt),
          ...(color !== undefined && { color: color ? titleCase(color) : null }),
          ...(categoryId && { category: { connect: { id: categoryId } } }),
          ...(brandId !== undefined && {
            brand: brandId ? { connect: { id: brandId } } : { disconnect: true },
          }),
          ...(newImages.length > 0 && { images: newImages }),
        },
      });
    });
    await bumpStorefrontCache();
    return product;
  },

  // Delete nahi, sirf chhupao — purane orders me product rehna chahiye.
  async hideProduct(id: string) {
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    await bumpStorefrontCache();
  },

  // Edit form (hidden product bhi).
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
        color: true,
        gender: true,
        ageGroup: true,
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

  // Admin list: hidden bhi. reservedQuantity = unpaid online orders me ruka stock.
  async listProducts(query: {
    q?: string;
    lowStock?: boolean;
    outOfStock?: boolean;
    cursor?: string;
    limit: number;
  }) {
    const rows = await prisma.product.findMany({
      where: {
        ...(query.q && { name: { contains: query.q, mode: "insensitive" } }),
        ...(query.outOfStock ? { stock: 0 } : query.lowStock ? { stock: { gt: 0, lte: LOW_STOCK_AT } } : {}),
      },
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
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });
    const page = paginate(rows, query.limit);

    const reserved = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { in: page.items.map((p) => p.id) }, order: { status: "PENDING" } },
      _sum: { quantity: true },
    });
    const items = page.items.map((p) => ({
      ...p,
      reservedQuantity: reserved.find((r) => r.productId === p.id)?._sum.quantity ?? 0,
    }));
    return { items, nextCursor: page.nextCursor };
  },

  // ---------- Category ----------
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

  async createCategory(data: { name: string; slug: string; parentId?: string }, image?: string) {
    if (data.parentId) await checkParent(data.parentId);
    const category = await prisma.category.create({ data: { ...data, image } });
    await bumpStorefrontCache();
    return category;
  },

  async updateCategory(
    id: string,
    data: { name?: string; slug?: string; parentId?: string | null; isActive?: boolean },
    image?: string,
  ) {
    if (data.parentId) {
      if (data.parentId === id) throw new AppError("Category cannot be its own parent", 400);
      await checkParent(data.parentId);
      // Jiske khud subcategories hain wo subcategory nahi ban sakti (3 level ho jaata).
      const children = await prisma.category.count({ where: { parentId: id } });
      if (children > 0) throw new AppError("Category with subcategories cannot become a subcategory", 400);
    }
    const category = await prisma.category.update({
      where: { id },
      data: { ...data, ...(image && { image }) },
    });
    await bumpStorefrontCache();
    return category;
  },

  // Products ya subcategory ho to delete nahi (inactive kar do).
  async deleteCategory(id: string) {
    const [products, children] = await Promise.all([
      prisma.product.count({ where: { categoryId: id } }),
      prisma.category.count({ where: { parentId: id } }),
    ]);
    if (products > 0) throw new AppError("Category has products, cannot delete", 409);
    if (children > 0) throw new AppError("Category has subcategories, cannot delete", 409);
    await prisma.category.delete({ where: { id } });
    await bumpStorefrontCache();
  },

  // ---------- Brand ----------
  async listBrands() {
    return prisma.brand.findMany({
      select: { id: true, name: true, slug: true, logo: true, isActive: true },
      orderBy: { name: "asc" },
    });
  },

  async createBrand(data: { name: string; slug: string }, logo?: string) {
    const brand = await prisma.brand.create({ data: { ...data, logo } });
    await bumpStorefrontCache();
    return brand;
  },

  async updateBrand(id: string, data: { name?: string; slug?: string; isActive?: boolean }, logo?: string) {
    const brand = await prisma.brand.update({ where: { id }, data: { ...data, ...(logo && { logo }) } });
    await bumpStorefrontCache();
    return brand;
  },

  async deleteBrand(id: string) {
    const products = await prisma.product.count({ where: { brandId: id } });
    if (products > 0) {
      throw new AppError(
        `Brand has ${products} product(s), cannot delete. Remove brand from products first.`,
        409,
      );
    }
    await prisma.brand.delete({ where: { id } });
    await bumpStorefrontCache();
  },

  // ---------- Banner ----------
  async listBanners() {
    return prisma.banner.findMany({
      select: { id: true, image: true, link: true, position: true, isActive: true },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    });
  },

  async createBanner(data: { link?: string; position: number }, image: string) {
    const banner = await prisma.banner.create({ data: { ...data, image } });
    await bumpStorefrontCache();
    return banner;
  },

  async updateBanner(
    id: string,
    data: { link?: string | null; position?: number; isActive?: boolean },
    image?: string,
  ) {
    const banner = await prisma.banner.update({ where: { id }, data: { ...data, ...(image && { image }) } });
    await bumpStorefrontCache();
    return banner;
  },

  async deleteBanner(id: string) {
    await prisma.banner.delete({ where: { id } });
    await bumpStorefrontCache();
  },

  // ---------- Orders ----------
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
        createdAt: true,
        shipName: true,
        shipPhone: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });
    return paginate(rows, query.limit);
  },

  async getOrder(id: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, phone: true, name: true, email: true } },
        items: {
          select: {
            productId: true,
            productName: true,
            productImage: true,
            pricePaise: true,
            quantity: true,
          },
        },
      },
    });
    if (!order) throw new AppError("Order not found", 404);
    return order;
  },

  // ---------- Users ----------
  async listUsers(query: { q?: string; cursor?: string; limit: number }) {
    const rows = await prisma.user.findMany({
      where: { isDeleted: false, ...(query.q && { phone: { contains: query.q } }) },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        role: true,
        isBlocked: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });
    return paginate(rows, query.limit);
  },

  async getUser(id: string) {
    const user = await prisma.user.findFirst({
      where: { id, isDeleted: false },
      select: {
        id: true,
        phone: true,
        alternatePhone: true,
        name: true,
        email: true,
        role: true,
        isBlocked: true,
        createdAt: true,
        addresses: true,
        _count: { select: { orders: true } },
      },
    });
    if (!user) throw new AppError("User not found", 404);
    return user;
  },

  // Block pe user ke saare device turant logout.
  async setUserBlock(actor: Actor, userId: string, isBlocked: boolean) {
    await checkCanManage(actor, userId);
    await prisma.user.update({ where: { id: userId }, data: { isBlocked } });
    if (isBlocked) await tokenService.revokeAllSessions(userId);
  },

  // Sirf SUPER_ADMIN (route pe check). Role badla to purani sessions khatam — naya role turant lage.
  async setUserRole(actor: Actor, userId: string, role: "USER" | "ADMIN") {
    await checkCanManage(actor, userId);
    await prisma.user.update({ where: { id: userId }, data: { role } });
    await tokenService.revokeAllSessions(userId);
  },

  async deleteUser(actor: Actor, userId: string) {
    await checkCanManage(actor, userId);
    await userService.deleteAccount(userId);
  },
};
