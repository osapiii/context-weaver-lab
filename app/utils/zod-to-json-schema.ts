import { z } from "zod";

/**
 * ZodスキーマをJSON Schema形式に変換する
 * Firebase AI Logic SDKのresponseSchemaで使用するため
 */
export function zodToJsonSchema(zodSchema: z.ZodTypeAny): Record<string, unknown> {
  if (zodSchema instanceof z.ZodObject) {
    const shape = zodSchema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as z.ZodTypeAny;
      const jsonSchema = zodToJsonSchema(fieldSchema);
      properties[key] = jsonSchema;

      // optional()でない場合はrequiredに追加
      if (!(fieldSchema instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  if (zodSchema instanceof z.ZodArray) {
    return {
      type: "array",
      items: zodToJsonSchema(zodSchema.element),
    };
  }

  if (zodSchema instanceof z.ZodString) {
    return { type: "string" };
  }

  if (zodSchema instanceof z.ZodNumber) {
    return { type: "number" };
  }

  if (zodSchema instanceof z.ZodBoolean) {
    return { type: "boolean" };
  }

  if (zodSchema instanceof z.ZodOptional) {
    return zodToJsonSchema(zodSchema.unwrap());
  }

  if (zodSchema instanceof z.ZodNullable) {
    return {
      ...zodToJsonSchema(zodSchema.unwrap()),
      nullable: true,
    };
  }

  // デフォルトはanyとして扱う
  return { type: "object" };
}

