import { PrismaClient } from "@prisma/client";
import { seed } from "./seed";

async function query() {
  const prisma = new PrismaClient();

  const result = await prisma.simple.aggregate({
    _sum: {
      age: true,
    },
  });

  // COMPILE ERR ========================================
  //     refuses to compile with msg:
  //    'result._sum.age' is possibly 'null'.
  // const badValue: number = result._sum.age + 99;
  // const iffyValue: number | null = result._sum.age + 99;
  // ====================================================

  // But this works:
  const goodValue: number = Number(result._sum.age) + 99;

  const msg: string = `
  results of ORM queries--------
  result: ${JSON.stringify(result)}
  result._sum.age: ${result._sum.age} (type: ${typeof result._sum.age})
  goodValue: ${goodValue} (type: ${typeof goodValue})
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
