import { HttpTypes } from "@medusajs/types";

import { sdk } from "@/lib/config";
import { SortOptions } from "@/lib/types";
import { sortProducts } from "@/lib/utils/sort-products";

import { getRegion } from "./regions";

export async function getProductsById(data: { ids: string[]; regionId: string }) {
  const { ids, regionId } = data;

  return sdk.store.product
    .list({
      id: ids,
      region_id: regionId,
      fields: "*variants.calculated_price,+variants.inventory_quantity",
    })
    .then(({ products }) => products);
}

export async function getProductByHandle(handle: string, countryCode: string) {
  const region = await getRegion(countryCode);

  if (!region) {
    return null;
  }

  return sdk.store.product
    .list({
      handle,
      region_id: region.id,
      fields: "*variants.calculated_price,+variants.inventory_quantity,*categories",
    })
    .then(({ products }) => products[0]);
}

export async function getProductsList(data: {
  pageParam?: number;
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams;
  countryCode: string;
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number };
  nextPage: number | null;
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams;
}> {
  const { pageParam = 1, queryParams, countryCode } = data;

  const limit = queryParams?.limit || 12;
  const offset = pageParam * limit;
  const region = await getRegion(countryCode);

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    };
  }

  return sdk.store.product
    .list(
      {
        // limit,
        // offset,
        region_id: region.id,
        fields: "*variants.calculated_price",
        ...queryParams,
      },
      { next: { tags: ["products"] } }
    )
    .then(({ products, count }) => {
      const nextPage = count > offset + limit ? pageParam + 1 : null;

      return {
        response: {
          products,
          count,
        },
        nextPage: nextPage,
        queryParams,
      };
    });
}

/**
 * This will fetch 100 products to the Next.js cache and sort them based on the sortBy parameter.
 * It will then return the paginated products based on the page and limit parameters.
 */
export async function getProductsListWithSort({
  page = 0,
  queryParams,
  sortBy = "created_at",
  countryCode,
}: {
  page?: number;
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams;
  sortBy?: SortOptions;
  countryCode: string;
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number };
  nextPage: number | null;
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams;
}> {
  const limit = queryParams?.limit || 12;

  const {
    response: { products, count },
  } = await getProductsList({
    pageParam: 0,
    queryParams: {
      ...queryParams,
      limit: 100,
    },
    countryCode,
  });

  const sortedProducts = sortProducts(products, sortBy);

  const pageParam = (page - 1) * limit;

  const nextPage = count > pageParam + limit ? pageParam + limit : null;

  const paginatedProducts = sortedProducts.slice(pageParam, pageParam + limit);

  return {
    response: {
      products: paginatedProducts,
      count,
    },
    nextPage,
    queryParams,
  };
}
