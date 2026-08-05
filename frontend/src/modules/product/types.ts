export type ProductStatus = 0 | 1;
export type ProductRecord = {
  id: string; name: string; description: string; ownerId: string; ownerName: string;
  status: ProductStatus; creatorName: string; updaterName: string; createdAt: string; updatedAt: string;
};
export type ProductFormValues = { name: string; ownerId: string; description?: string; status?: ProductStatus };

export type ProductMaintenanceContractStatus = 'pending' | 'active' | 'expired' | 'renewed' | 'terminated';
export type ProductMaintenanceContractAttachment = {
  id: string;
  contractId: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  sortOrder: number;
  creatorName: string;
  createdAt: string;
};
export type ProductMaintenanceContract = {
  id: string;
  productId: string;
  productName: string;
  previousContractId: string;
  previousContractName: string;
  contractCode: string;
  contractName: string;
  supplierId: string;
  supplierName: string;
  signedDate: string;
  serviceStartDate: string;
  serviceEndDate: string;
  contractAmount: number;
  terminationDate: string;
  terminationReason: string;
  remark: string;
  status: ProductMaintenanceContractStatus;
  hasSuccessor: boolean;
  creatorName: string;
  updaterName: string;
  createdAt: string;
  updatedAt: string;
  attachments: ProductMaintenanceContractAttachment[];
};
export type ProductMaintenanceContractFormValues = {
  contractCode: string;
  contractName: string;
  supplierId: string;
  signedDate: string;
  serviceStartDate: string;
  serviceEndDate: string;
  contractAmount: string;
  remark?: string;
};
