import { Timestamp } from "firebase/firestore";
import { z } from "zod";
import { firestoreTypeConverter } from "./firestoreTypeConverter";

export const materialPurchaseRecordZodObject = z.object({
  materialCode: z.string().optional(),
  materialName: z.string().optional(),
  purchaseDate: z.string().optional(),
  quantity: z.union([z.string(), z.number()]).optional(),
  unit: z.string().optional(),
  unitPrice: z.union([z.string(), z.number()]).optional(),
  totalAmount: z.union([z.string(), z.number()]).optional(),
  lotNumber: z.string().optional(),
  note: z.string().optional(),
});

export const decodedMaterialPurchaseRecordZodObject =
  materialPurchaseRecordZodObject.extend({
    id: z.string(),
    createdAt: z.instanceof(Timestamp).optional(),
    updatedAt: z.instanceof(Timestamp).optional(),
  });

export type DecodedMaterialPurchaseRecord = z.infer<
  typeof decodedMaterialPurchaseRecordZodObject
>;

export const materialPurchaseRecordConverter = firestoreTypeConverter(
  decodedMaterialPurchaseRecordZodObject
);
