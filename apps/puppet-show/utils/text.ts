/* utils/text.ts */

/* "mARIA  da silva" -> "Maria Da Silva" */
export function FormatPersonName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
};
