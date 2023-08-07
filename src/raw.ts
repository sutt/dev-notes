import { PrismaClient } from "@prisma/client";
import { seed } from "./seed";

interface QueryIntResult {
  mySum: number;
}

interface QueryStrResult {
  mySum: string;
}

async function query() {
  const prisma = new PrismaClient();

  const rawInt: QueryIntResult[] = await prisma.$queryRaw<QueryIntResult[]>`
    SELECT coalesce(SUM(age),"") as mySum FROM simple;
    `;

  const rawStr: QueryStrResult[] = await prisma.$queryRaw<QueryStrResult[]>`
    SELECT "4" as mySum;
    `;

  const badInt: QueryIntResult[] = await prisma.$queryRaw<QueryIntResult[]>`
    SELECT coalesce(SUM(fav),"bad") as mySum FROM simple;
    `;

  const badValue: number = badInt[0].mySum + 99;
  
  const msg: string = `
  results of RAW queries--------
  rawInt: ${rawInt[0].mySum} (type: ${typeof rawInt[0].mySum})
  rawStr: ${rawStr[0].mySum} (type: ${typeof rawStr[0].mySum})
  badInt: ${badInt[0].mySum} (type: ${typeof badInt[0].mySum})
  badValue:
    (typed number, but has type ${typeof badValue})
    value: ${badValue}
  ------------------------------
  `;
  console.log(msg);

  prisma.$disconnect();
}

async function main() {
  seed()
    .catch((e) => {
      console.error(e);
    })
    .then(() => {
      query().catch((e) => {
        console.error(e);
      });
    });
}

main();
