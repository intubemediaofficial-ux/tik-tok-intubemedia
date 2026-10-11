import { bootstrap } from "../src/lib/bootstrap";
import { db } from "../src/lib/db";

bootstrap()
  .then(() => console.log("seed ok"))
  .finally(async () => { await db.$disconnect(); process.exit(0); });
