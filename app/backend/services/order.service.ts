import { prisma } from "../prisma";
import { OrderType, OrderStatus } from "@prisma/client";

/**
 * Create a buy order
 */
export async function createBuyOrder(userId: string, quantityGrams: number) {
  // Lock indicative price - for demo, use a fixed price
  const priceLocked = 50.0; // USD per gram

  const order = await prisma.order.create({
    data: {
      userId,
      type: OrderType.BUY,
      quantityGrams,
      priceLocked,
      isTestnet: true,
    },
  });

  return order;
}

/**
 * Create a sell order
 */
export async function createSellOrder(userId: string, quantityGrams: number) {
  // Lock indicative price - for demo, use a fixed price
  const priceLocked = 50.0; // USD per gram

  const order = await prisma.order.create({
    data: {
      userId,
      type: OrderType.SELL,
      quantityGrams,
      priceLocked,
      isTestnet: true,
    },
  });

  return order;
}

/**
 * Get user's orders
 */
export async function getUserOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Settle an order (admin)
 */
export async function settleOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");

  await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.SETTLED },
  });

  return { success: true, message: "Order settled" };
}

/**
 * Reject an order (admin)
 */
export async function rejectOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");

  await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.REJECTED },
  });

  return { success: true, message: "Order rejected" };
}
