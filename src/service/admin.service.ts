import { Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "../config/db";
import { cache } from "../utils/cache";
import { AppError } from "../utils/appError";
import { PaginatedResult } from "../types";
import { embeddingService } from "./embedding.service";

// Cache invalidate helpers — admin write ke baad stale cache hatao.
// Product badle to home + (slug ho to) detail cache clear + AI cache version bump
// (assistant ki saari purani cached replies turant invalid — AI hamesha up-to-date).
async function clearProductCaches(slug?: string) {
  const keys = ["home:data"];
  if (slug) keys.push(`product:${slug}`);
  await cache.del(...keys);
  await cache.bumpVersion("ai:ver");
}

type ProductCreateInput = {
  name: string;
  slug: string;
  description: string;
  price: number; // rupee
  discountPercent?: number;
  stock?: number;
  categoryId: string;
  brandId?: string;
  color?: string;
  isTrending?: boolean;
};

type BulkProductInput = ProductCreateInput & { images: string[] };

export const adminService = {
  // ---------- Product ----------
  // Bulk create — 50 tak ek saath. Duplicate slug wale skip hote hain (report me
  // dikhte hain), baaki ban jaate hain. searchVector DB trigger se apne aap banta hai.
  async bulkCreateProducts(products: BulkProductInput[]) {
    // Payload ke andar hi duplicate slug na ho.
    const slugs = products.map((p) => p.slug);
    if (new Set(slugs).size !== slugs.length) {
      throw new AppError("Duplicate slugs in the uploaded list", 400);
    }

    // Category/brand ids sahi hain ya nahi — pehle check, warna aadha create hoke FK error.
    const categoryIds = [...new Set(products.map((p) => p.categoryId))];
    const foundCats = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    });
    if (foundCats.length !== categoryIds.length) {
      throw new AppError("One or more categoryId not found", 400);
    }

    const brandIds = [
      ...new Set(products.map((p) => p.brandId).filter((b): b is string => !!b)),
    ];
    if (brandIds.length > 0) {
      const foundBrands = await prisma.brand.findMany({
        where: { id: { in: brandIds } },
        select: { id: true },
      });
      if (foundBrands.length !== brandIds.length) {
        throw new AppError("One or more brandId not found", 400);
      }
    }

    // Jo slugs DB me pehle se hain wo skip (dobara upload safe — idempotent).
    const existing = await prisma.product.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true },
    });
    const existingSlugs = new Set(existing.map((e) => e.slug));
    const toCreate = products.filter((p) => !existingSlugs.has(p.slug));

    if (toCreate.length > 0) {
      await prisma.product.createMany({
        data: toCreate.map((p) => ({
          name: p.name,
          slug: p.slug,
          description: p.description,
          pricePaise: Math.round(p.price * 100),
          discountPercent: p.discountPercent ?? 0,
          stock: p.stock ?? 0,
          categoryId: p.categoryId,
          brandId: p.brandId,
          color: p.color,
          isTrending: p.isTrending ?? false,
          images: p.images,
        })),
      });
      await clearProductCaches();

      // Naye products ke embeddings background me — pgvector semantic search ke liye
      // (response block nahi hota, fail ho to sirf log; full-text phir bhi chalta hai).
      const createdRows = await prisma.product.findMany({
        where: { slug: { in: toCreate.map((p) => p.slug) } },
        select: { id: true },
      });
      embeddingService.syncInBackground(createdRows.map((r) => r.id));
    }

    return { created: toCreate.length, skipped: [...existingSlugs] };
  },

  async createProduct(data: ProductCreateInput, images: string[]) {
    if (images.length === 0) {
      throw new AppError("At least one product image required", 400);
    }
    const exists = await prisma.product.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });
    if (exists) throw new AppError("Slug already in use", 409);

    const product = await prisma.product.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        pricePaise: Math.round(data.price * 100),
        discountPercent: data.discountPercent ?? 0,
        stock: data.stock ?? 0,
        categoryId: data.categoryId,
        brandId: data.brandId,
        color: data.color,
        isTrending: data.isTrending ?? false,
        images,
      },
    });
    await clearProductCaches();
    embeddingService.syncInBackground([product.id]); // AI search ke liye, fail = sirf log
    return product;
  },

  async updateProduct(
    id: string,
    // brandId null = product se brand hatao.
    data: Partial<Omit<ProductCreateInput, "brandId">> & {
      brandId?: string | null;
      isActive?: boolean;
    },
    newImages: string[]
  ) {
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { slug: true },
    });
    if (!existing) throw new AppError("Product not found", 404);

    const updateData: Prisma.ProductUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.price !== undefined) updateData.pricePaise = Math.round(data.price * 100);
    if (data.discountPercent !== undefined)
      updateData.discountPercent = data.discountPercent;
    if (data.stock !== undefined) updateData.stock = data.stock;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.isTrending !== undefined) updateData.isTrending = data.isTrending;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.categoryId !== undefined)
      updateData.category = { connect: { id: data.categoryId } };
    if (data.brandId !== undefined)
      updateData.brand =
        data.brandId === null
          ? { disconnect: true }
          : { connect: { id: data.brandId } };
    // Nayi images aayi to replace, warna purani rehne do.
    if (newImages.length > 0) updateData.images = newImages;

    const product = await prisma.product.update({ where: { id }, data: updateData });
    await clearProductCaches(existing.slug);
    if (data.slug && data.slug !== existing.slug) {
      await cache.del(`product:${data.slug}`);
    }
    // Name/description/color badla ho to embedding refresh (background me).
    embeddingService.syncInBackground([product.id]);
    return product;
  },

  // Soft delete (isActive false) — order history product reference safe rahe.
  async deleteProduct(id: string) {
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { slug: true },
    });
    if (!existing) throw new AppError("Product not found", 404);

    await prisma.product.update({ where: { id }, data: { isActive: false } });
    await clearProductCaches(existing.slug);
  },

  // Edit form ke liye full product (inactive bhi milta hai — public API me nahi milta).
  async getProduct(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true, name: true, slug: true, description: true, pricePaise: true,
        discountPercent: true, stock: true, color: true, images: true,
        categoryId: true, brandId: true, isActive: true, isTrending: true,
      },
    });
    if (!product) throw new AppError("Product not found", 404);
    return product;
  },

  // Admin product list — apna search/filter (active+inactive dono dikhte hain).
  async listProducts(
    q: string | undefined,
    cursor: string | undefined,
    limit: number
  ): Promise<PaginatedResult<unknown>> {
    const where: Prisma.ProductWhereInput = q
      ? { name: { contains: q, mode: "insensitive" } }
      : {};

    const items = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        pricePaise: true,
        stock: true,
        isActive: true,
        isTrending: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = items.length > limit;
    const sliced = hasMore ? items.slice(0, limit) : items;
    return {
      items: sliced,
      nextCursor: hasMore ? (sliced[sliced.length - 1] as { id: string }).id : null,
    };
  },

  // ---------- Category ----------
  // Tree sirf 2-level hai: category -> subcategory. Parent khud top-level hona chahiye.
  async assertValidParent(parentId: string) {
    const parent = await prisma.category.findUnique({
      where: { id: parentId },
      select: { parentId: true },
    });
    if (!parent) throw new AppError("Parent category not found", 404);
    if (parent.parentId) {
      throw new AppError("Subcategory cannot have its own subcategory", 400);
    }
  },

  async createCategory(data: { name: string; slug: string; parentId?: string }, image?: string) {
    const exists = await prisma.category.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });
    if (exists) throw new AppError("Slug already in use", 409);
    if (data.parentId) await this.assertValidParent(data.parentId);

    const category = await prisma.category.create({ data: { ...data, image } });
    await cache.del("categories:tree", "home:data");
    return category;
  },

  async updateCategory(
    id: string,
    data: { name?: string; slug?: string; parentId?: string | null; isActive?: boolean },
    image?: string
  ) {
    const existing = await prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new AppError("Category not found", 404);
    if (data.parentId === id) throw new AppError("Category cannot be its own parent", 400);

    // Parent set kar rahe ho to: parent top-level ho + is category ke apne children na hon
    // (warna tree 3-level ho jaata — design 2-level ka hai).
    if (data.parentId) {
      await this.assertValidParent(data.parentId);
      const childCount = await prisma.category.count({ where: { parentId: id } });
      if (childCount > 0) {
        throw new AppError("Category with subcategories cannot become a subcategory", 400);
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: { ...data, ...(image && { image }) },
    });
    await cache.del("categories:tree", "home:data");

    // Category ka naam badla to uske products ka searchVector refresh (dummy update
    // se trigger fire hota hai — alag se vector likhne ki zaroorat nahi).
    if (data.name !== undefined) {
      await prisma.$executeRaw`UPDATE "Product" SET "categoryId" = "categoryId" WHERE "categoryId" = ${id}`;
    }
    return category;
  },

  async deleteCategory(id: string) {
    const productCount = await prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      throw new AppError("Category has products, cannot delete", 409);
    }
    const childCount = await prisma.category.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new AppError("Category has subcategories, cannot delete", 409);
    }
    await prisma.category.delete({ where: { id } });
    await cache.del("categories:tree", "home:data");
  },

  // ---------- Brand ----------
  async createBrand(data: { name: string; slug: string }, logo?: string) {
    const exists = await prisma.brand.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });
    if (exists) throw new AppError("Slug already in use", 409);

    const brand = await prisma.brand.create({ data: { ...data, logo } });
    await cache.del("brands:all");
    return brand;
  },

  async updateBrand(
    id: string,
    data: { name?: string; slug?: string; isActive?: boolean },
    logo?: string
  ) {
    const existing = await prisma.brand.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new AppError("Brand not found", 404);

    const brand = await prisma.brand.update({
      where: { id },
      data: { ...data, ...(logo && { logo }) },
    });
    await cache.del("brands:all");

    // Brand ka naam badla to us brand ke products ka searchVector refresh karo.
    // "brandId = brandId" dummy update trigger fire karta hai (value same rehti hai).
    if (data.name !== undefined) {
      await prisma.$executeRaw`UPDATE "Product" SET "brandId" = "brandId" WHERE "brandId" = ${id}`;
    }
    return brand;
  },

  // Brand delete — products use kar rahe hon to block (warna unka brand link toot jaata).
  // Pehle un products se brand hatao ya unhe delete karo, phir brand delete hoga.
  async deleteBrand(id: string) {
    const existing = await prisma.brand.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new AppError("Brand not found", 404);

    const productCount = await prisma.product.count({ where: { brandId: id } });
    if (productCount > 0) {
      throw new AppError(
        `Brand has ${productCount} product(s), cannot delete. Remove brand from products first.`,
        409
      );
    }

    await prisma.brand.delete({ where: { id } });
    await cache.del("brands:all");
  },

  // ---------- Banner ----------
  async createBanner(data: { link?: string; position?: number }, image: string) {
    const banner = await prisma.banner.create({
      data: { image, link: data.link, position: data.position ?? 0 },
    });
    await cache.del("home:data");
    return banner;
  },

  async updateBanner(
    id: string,
    data: { link?: string | null; position?: number; isActive?: boolean },
    image?: string
  ) {
    const existing = await prisma.banner.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new AppError("Banner not found", 404);

    const banner = await prisma.banner.update({
      where: { id },
      data: { ...data, ...(image && { image }) },
    });
    await cache.del("home:data");
    return banner;
  },

  async deleteBanner(id: string) {
    const existing = await prisma.banner.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new AppError("Banner not found", 404);
    await prisma.banner.delete({ where: { id } });
    await cache.del("home:data");
  },

  // ---------- Users ----------
  // User list (phone se search). Admin panel ke liye.
  async listUsers(
    q: string | undefined,
    cursor: string | undefined,
    limit: number
  ): Promise<PaginatedResult<unknown>> {
    const where: Prisma.UserWhereInput = q
      ? { phone: { contains: q } }
      : {};

    const items = await prisma.user.findMany({
      where,
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        role: true,
        isBlocked: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = items.length > limit;
    const sliced = hasMore ? items.slice(0, limit) : items;
    return {
      items: sliced,
      nextCursor: hasMore ? (sliced[sliced.length - 1] as { id: string }).id : null,
    };
  },

  // User block/unblock. SUPER_ADMIN ko koi block nahi kar sakta.
  async setUserBlock(id: string, isBlocked: boolean) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!user) throw new AppError("User not found", 404);
    if (user.role === "SUPER_ADMIN") {
      throw new AppError("Super admin cannot be blocked", 403);
    }

    await prisma.user.update({ where: { id }, data: { isBlocked } });
  },

  // Role toggle — USER <-> ADMIN. SUPER_ADMIN ka role kabhi change nahi hota.
  // (Route level pe sirf SUPER_ADMIN hi yahan tak pahunch sakta hai.)
  async setUserRole(id: string, role: "USER" | "ADMIN") {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!user) throw new AppError("User not found", 404);
    if (user.role === "SUPER_ADMIN") {
      throw new AppError("Super admin role cannot be changed", 403);
    }

    await prisma.user.update({ where: { id }, data: { role } });
  },

  // ---------- Orders ----------
  async listOrders(
    status: OrderStatus | undefined,
    cursor: string | undefined,
    limit: number
  ): Promise<PaginatedResult<unknown>> {
    const where: Prisma.OrderWhereInput = status ? { status } : {};

    const items = await prisma.order.findMany({
      where,
      select: {
        id: true,
        totalPaise: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true, // COD vs online — CANCELLED + COMPLETED = refund pending
        createdAt: true,
        shipName: true,
        shipPhone: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = items.length > limit;
    const sliced = hasMore ? items.slice(0, limit) : items;
    return {
      items: sliced,
      nextCursor: hasMore ? (sliced[sliced.length - 1] as { id: string }).id : null,
    };
  },

  // Status update — admin shipped/delivered mark karta hai. CANCELLED pe stock wapas.
  // COD order DELIVERED hote hi payment bhi COMPLETED (cash mil gaya).
  async updateOrderStatus(id: string, status: OrderStatus) {
    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true, paymentMethod: true },
    });
    if (!order) throw new AppError("Order not found", 404);

    if (status === "CANCELLED" && order.status !== "CANCELLED") {
      // Stock wapas badhao (jo order pe reserve hua tha).
      await prisma.$transaction(async (tx) => {
        const items = await tx.orderItem.findMany({
          where: { orderId: id },
          select: { productId: true, quantity: true },
        });
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
        await tx.order.update({
          where: { id },
          data: { status: "CANCELLED" },
        });
      });
      return;
    }

    await prisma.order.update({
      where: { id },
      data: {
        status,
        // COD: delivery = cash mila = payment complete.
        ...(status === "DELIVERED" &&
          order.paymentMethod === "COD" && { paymentStatus: "COMPLETED" as const }),
      },
    });
  },
};
