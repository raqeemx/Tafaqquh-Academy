export const kinds = [
  "program",
  "subject",
  "book",
  "series",
  "lesson",
] as const;
export type Kind = (typeof kinds)[number];
export const labels: Record<Kind, string> = {
  program: "برنامج",
  subject: "مادة",
  book: "كتاب",
  series: "سلسلة",
  lesson: "درس",
};
export type CatalogEntry = {
  id: string;
  kind: Kind;
  title: string;
  description: string;
  programId: string;
  parentId: string;
  order: number;
  lessonDate: string;
  published: boolean;
  progressEnabled: boolean;
  version: string;
};
export const parents: Record<Kind, Kind[]> = {
  program: [],
  subject: [],
  book: ["subject"],
  series: ["subject", "book"],
  lesson: ["series"],
};
export function collectionFor(kind: Kind) {
  return kind === "program" ? "programs" : "catalog";
}
