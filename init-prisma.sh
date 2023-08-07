# remove previous database and migrations
rm prisma/dev.db
rm -rf prisma/migrations

# generates the prisma client
# based on the schema.prisma file
npx prisma generate

# initializes the database
npx prisma migrate dev --name init



