import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const line1 = await prisma.productionLine.upsert({
    where: { code: "L1" },
    update: {},
    create: { code: "L1", name: "조립 1라인 (완제품)", weeklyCapacity: 2000 },
  });
  const line2 = await prisma.productionLine.upsert({
    where: { code: "L2" },
    update: {},
    create: { code: "L2", name: "부품 1라인 (PBA/하네스)", weeklyCapacity: 10000 },
  });

  const customer = await prisma.partner.upsert({
    where: { code: "C001" },
    update: {},
    create: { code: "C001", name: "샘플전자(주)", type: "CUSTOMER" },
  });
  await prisma.partner.upsert({
    where: { code: "V001" },
    update: {},
    create: { code: "V001", name: "샘플부품상사", type: "VENDOR" },
  });

  const monitor = await prisma.item.upsert({
    where: { code: "FG-MON-215" },
    update: {},
    create: {
      code: "FG-MON-215",
      name: '21.5" 기업용 터치모니터',
      type: "FG",
      defaultLineId: line1.id,
    },
  });
  const pba = await prisma.item.upsert({
    where: { code: "SF-PBA-MON" },
    update: {},
    create: {
      code: "SF-PBA-MON",
      name: "터치모니터 메인 PBA",
      type: "SF",
      defaultLineId: line2.id,
    },
  });
  const panel = await prisma.item.upsert({
    where: { code: "RM-PNL-215" },
    update: {},
    create: { code: "RM-PNL-215", name: '21.5" 터치패널', type: "RM" },
  });
  const relay = await prisma.item.upsert({
    where: { code: "FG-RLY-12V" },
    update: {},
    create: {
      code: "FG-RLY-12V",
      name: "12V 릴레이 (납품용)",
      type: "FG",
      defaultLineId: line2.id,
    },
  });

  for (const [parentItemId, childItemId, qtyPer] of [
    [monitor.id, pba.id, 1],
    [monitor.id, panel.id, 1],
  ]) {
    await prisma.bomLine.upsert({
      where: {
        parentItemId_childItemId: { parentItemId, childItemId },
      },
      update: { qtyPer },
      create: { parentItemId, childItemId, qtyPer },
    });
  }

  const inTwoWeeks = new Date();
  inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);
  const inFourWeeks = new Date();
  inFourWeeks.setDate(inFourWeeks.getDate() + 28);

  await prisma.salesOrder.upsert({
    where: { orderNo: "SO-2026-001" },
    update: {},
    create: {
      orderNo: "SO-2026-001",
      customerId: customer.id,
      orderDate: new Date(),
      lines: {
        create: [
          { lineNo: 1, itemId: monitor.id, qty: 500, dueDate: inTwoWeeks },
          { lineNo: 2, itemId: relay.id, qty: 8000, dueDate: inFourWeeks },
        ],
      },
    },
  });

  console.log("seed 완료");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
