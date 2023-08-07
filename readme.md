## Typescript - type checking SQL/ORM query results

*How typescript can ensure correctness...
 ...and where it doesn't.*

#### ⚡Motivation

I recently started writing typescript for a [hackathon](https://bolt.fun/tournaments/ai4all/overview) I've been involved in and on the heels of that, I saw a [StackerNews post](https://stacker.news/items/217122) that their site had just inadvertantly paid out .2 BTC to a user (roughly $6,000 as of writing). Most of the comments suggest **type safety** as the best way to preventthis kind of situation, and given that the Stacker News web app is built in javascript, it would be a perfect opportunity to explore what types of protections typescript can provide, and if it would have prevented this bug.

#### 🪲 The Bug

As the [post](https://stacker.news/items/217122) lays out:

> ...The latest version of our ORM started returning type String for the result of postgresql SUM aggregates. Rewards add (+) the sum of all revenue earned to the sum of all donated sats. The sum of all revenue yesterday was 8674317 msats and the donation sum was 1000000 msats.
>
> Because they were strings and not numbers, they got concatenated rather than added like numbers. What should have been 8774317 msats (8774 sats) became 86743171000000 msats (86743171000 sats) ... the result of visually joining the numbers together...

 - The ORM is [prisma](https://github.com/prisma/prisma) using postgresql as the database.
 - The app's behavior change came with [this commit](https://github.com/stackernews/stacker.news/commit/6f445f254530d9830fbe5d99036c53f6d0ac5e54) updating the `prisma` dependecy to version 5.0.0
 - The actual section of code looks like [this](https://github.com/stackernews/stacker.news/blob/c088a379d7037cbd7098d892ae03f557af87cc75/worker/earn.js#L12-L27) now that is has been corrected:

```javascript

const [{ sum: actSum }] = await models.$queryRaw`
    SELECT coalesce(sum("ItemAct".msats - coalesce("ReferralAct".msats, 0)), 0) as sum
    FROM "ItemAct"
    JOIN "Item" ON "ItemAct"."itemId" = "Item".id
    LEFT JOIN "ReferralAct" ON "ItemAct".id = "ReferralAct"."itemActId"
    WHERE "ItemAct".act <> 'TIP'
        AND "ItemAct".created_at > now_utc() - INTERVAL '1 day'`


const [{ sum: donatedSum }] = await models.$queryRaw`
    SELECT coalesce(sum(sats), 0) as sum
    FROM "Donation"
    WHERE created_at > now_utc() - INTERVAL '1 day'`


// XXX prisma returns wonky types from raw queries ... so be extra
// careful with them
const sum = Number(actSum) + (Number(donatedSum) * 1000)

```

As you can see, the problem was `sum` was being returned as a string, thus the added code below it, casting it with `Number` to ensure the correct behavior.

To understand how this code fits into the app as a whole: this code runs once everyday and applies a bonus earning to each user. On stacker news, earnings are of course in [satoshis](https://www.coindesk.com/learn/what-is-a-satoshi-understanding-the-smallest-unit-of-bitcoin/), which are units of bitcoin and can be deposited, or in this case withdrawn in seconds through the [lightning network](https://en.wikipedia.org/wiki/Lightning_Network). That means if this function overpays, a user who notices the mistake can withdraw the funds before the tally is corrected, as happend in this case.

One other thing to note is that the code is using `$queryRaw` method, which unsurprisingly takes. This is in contrast to using query builder methods that come with most ORM's, including prisma, that take structured arguments and may return structured and typed results. More on this later...

####🧠 Reproducing

We build a simple prisma model (`Simple`) using sqlite as the backend and seed it with some values. We then write to queries: `raw.ts` and `orm.ts` to query the seeded DB throught a variety of means.

##### quickstart instructions

```bash
# initial install
> git clone [this repo]
> npm install
# ts compile
# no need for tsc --init since I'll include tsconfig.json
# this will compile to dist/
> tsc  
# init the database with prisma
> npx prisma generate
> npx prisma migrate dev --name init
# run scripts
> node dist/raw.js
> node dist/orm.js
```

- running compiled **`raw.js`**:
```bash
results of RAW queries--------
rawInt: 1 (type: bigint)
rawStr: 4 (type: string)
badInt: bad (type: string)
badValue:
(typed number, but has type string)
value: bad99

```

 - running compiled **`orm.js`**:
```bash
results of ORM queries--------
result: {"_sum":{"age":1}}
result._sum.age: 1 (type: number)
goodValue: 100 (type: number)
```

I was unable to reproduce StackerNews exact behavior of an aggregate sum producing a string, but [exact issue](https://github.com/prisma/prisma/issues/20408) likely lies in how Prisma handles POSTGRES transactions.

####🔬 Analysis

In the **raw.ts** script, we see that typescript is unable to catch type issues, even by typing the result of the query as `QueryIntResult[]` and typing `badValue` as a number, we still end up with a string (and consequently concatenation for the `+` method) in the code.

```typescript

interface QueryIntResult {
  mySum: number;
}

const badInt: QueryIntResult[] = await prisma.$queryRaw<QueryIntResult[]>`
    SELECT coalesce(SUM(fav),"bad") as mySum FROM simple;
    `;

const badValue: number = badInt[0].mySum + 99;
// now badValue = "bad99" even though it's type is number

```

However in the **orm.ts** script, we see that typescript *is* able to catch type issues, where we won't be able to compile without applying the `Number` method to the query result. This is because [Prisma is able to infer the type](https://www.prisma.io/docs/concepts/components/prisma-client/advanced-type-safety/operating-against-partial-structures-of-model-types) of `SUM(age)` in the query is either javascript type `number | null` because the field in the database is nullable.

```typescript
// using the ORM method, it's impossible to return a string here
// because prisma knows its numeric. The best we can do is make
// it ambiguous if its null or a number.
const result = await prisma.simple.aggregate({
    _sum: {
        age: true,
    },
});

// COMPILE ERR: both these lines won't compile ========
// const badValue: number = result._sum.age + 99;
// const iffyValue: number | null = result._sum.age + 99;
// ====================================================

// But this works:
const goodValue: number = Number(result._sum.age) + 99;
// now goodValue = 100, exactly what we expect
```

In short: typescript can't catch this type of error if you're using raw queries; we must use ORM's to translate types b/w SQL and JS. Second of all, typescript's fix - casting with `Number` - is the same as the fix you'd use in base javascript. Just in the case of TS, you're forced to do it due to the compiler compalining.
  


#### 💪 Take-Aways
 1. Sharing your losses is a great way to share your most valuable lessons, and also can help other devs check their architecture and/or QA process to see if they could have caught them. (Thank you k00b!)
 1. Type checking is valuable not only for the code you write in your app, but also for the dependencies you use and allowing them to upgrade without fear of breaking your app.
 1. Typescript can't check every type, especially from raw SQL queries.
 1. In this case, simple coercion in vanilla javascript to expected type can do as much as the type safety of typescript.


