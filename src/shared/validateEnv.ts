import { format, styleText } from "node:util";
import type { ZodTypeAny } from "zod";

export async function validateEnv<TSchema extends ZodTypeAny>(schema: TSchema): Promise<Awaited<ReturnType<TSchema["parseAsync"]>>> {
  const result = await schema.safeParseAsync(process.env);

  if (!result.success) {
    console.log(
      result.error.issues
        .map((issue) =>
          format(
            styleText("red", "ENV VAR %s -> %s"),
            styleText("bold", issue.path.join(".")),
            styleText("gray", issue.message)
          )
        )
        .join("\n")
    );
    process.exit(1);
  }

  console.log(styleText("dim", "Environment variables validated"));
  return result.data as Awaited<ReturnType<TSchema["parseAsync"]>>;
}
