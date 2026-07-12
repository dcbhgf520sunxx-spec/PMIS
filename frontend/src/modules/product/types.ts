export type ProductStatus = 0 | 1;
export type ProductRecord = {
  id: string; name: string; description: string; ownerId: string; ownerName: string;
  status: ProductStatus; creatorName: string; updaterName: string; createdAt: string; updatedAt: string;
};
export type ProductFormValues = { name: string; ownerId: string; description?: string; status?: ProductStatus };
