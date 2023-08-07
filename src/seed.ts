import { PrismaClient } from "@prisma/client";

const data = [
  { name: "a", age: 1 },
  { name: "b", age: null },
];

export async function seed() {
  const prisma = new PrismaClient();

  await prisma.simple.deleteMany({});

  for (const simp of data) {
    const simp1 = await prisma.simple.create({
      data: simp,
    });
  }

  prisma.$disconnect();
}
