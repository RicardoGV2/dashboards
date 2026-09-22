import type {
  CanvasConnection,
  CanvasNode,
  FinanceNodeData,
} from "../document/index.ts";

export interface FinanceDemoScene {
  sceneId: string;
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  personIds: string[];
}

const money = (cents: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

function financeNode(
  sceneId: string,
  role: FinanceNodeData["role"],
  title: string,
  text: string,
  icon: string,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Omit<FinanceNodeData, "role" | "sceneId" | "icon"> = {},
): CanvasNode {
  return {
    id: crypto.randomUUID(),
    kind: "finance",
    x,
    y,
    width,
    height,
    title,
    text,
    color,
    finance: {
      role,
      sceneId,
      icon,
      ...extra,
    },
  };
}

function connection(
  from: string,
  to: string,
  kind: CanvasConnection["kind"],
  label = "",
  amountCents?: number,
): CanvasConnection {
  return {
    id: crypto.randomUUID(),
    from,
    to,
    kind,
    label,
    animated: kind !== "structure" && kind !== "shared",
    ...(amountCents === undefined
      ? {}
      : { amountCents, currency: "EUR" as const }),
  };
}

export function createFinanceDemo(
  centerX: number,
  centerY: number,
): FinanceDemoScene {
  const sceneId = crypto.randomUUID();
  const nodes: CanvasNode[] = [];
  const connections: CanvasConnection[] = [];

  const ricardo = financeNode(
    sceneId,
    "person",
    "Ricardo",
    "Personal finance hub",
    "RG",
    "#3b82f6",
    centerX - 610,
    centerY - 60,
    250,
    250,
    { expanded: true, category: "person" },
  );
  const janet = financeNode(
    sceneId,
    "person",
    "Janet",
    "Personal finance hub",
    "JH",
    "#8b5cf6",
    centerX + 360,
    centerY - 60,
    250,
    250,
    { expanded: true, category: "person" },
  );
  nodes.push(ricardo, janet);

  const ricardoWork = financeNode(
    sceneId,
    "source",
    "Work income",
    "Salary · monthly",
    "💼",
    "#22c55e",
    centerX - 545,
    centerY - 370,
    180,
    110,
    {
      ownerId: ricardo.id,
      category: "income",
      amountCents: 285000,
      currency: "EUR",
      cadence: "monthly",
    },
  );
  const janetWork = financeNode(
    sceneId,
    "source",
    "Work income",
    "Salary · monthly",
    "💼",
    "#22c55e",
    centerX + 425,
    centerY - 370,
    180,
    110,
    {
      ownerId: janet.id,
      category: "income",
      amountCents: 320000,
      currency: "EUR",
      cadence: "monthly",
    },
  );

  const ricardoRevolut = financeNode(
    sceneId,
    "bank",
    "Revolut",
    "Main account",
    "R",
    "#2563eb",
    centerX - 900,
    centerY - 15,
    210,
    210,
    {
      ownerId: ricardo.id,
      brand: "Revolut",
      category: "bank",
      amountCents: 184232,
      currency: "EUR",
    },
  );
  const ricardoBoi = financeNode(
    sceneId,
    "bank",
    "BOI",
    "Bills & savings",
    "BOI",
    "#2563eb",
    centerX - 280,
    centerY - 15,
    210,
    210,
    {
      ownerId: ricardo.id,
      brand: "Bank of Ireland",
      category: "bank",
      amountCents: 412000,
      currency: "EUR",
    },
  );
  const janetAib = financeNode(
    sceneId,
    "bank",
    "AIB",
    "Everyday banking",
    "AIB",
    "#a855f7",
    centerX + 70,
    centerY - 15,
    210,
    210,
    {
      ownerId: janet.id,
      brand: "AIB",
      category: "bank",
      amountCents: 234021,
      currency: "EUR",
    },
  );
  const janetRevolut = financeNode(
    sceneId,
    "bank",
    "Revolut",
    "Savings & travel",
    "R",
    "#2563eb",
    centerX + 685,
    centerY - 15,
    210,
    210,
    {
      ownerId: janet.id,
      brand: "Revolut",
      category: "bank",
      amountCents: 521050,
      currency: "EUR",
    },
  );
  nodes.push(
    ricardoWork,
    janetWork,
    ricardoRevolut,
    ricardoBoi,
    janetAib,
    janetRevolut,
  );

  const destinations: Array<{
    owner: CanvasNode;
    bank: CanvasNode;
    title: string;
    icon: string;
    amount: number;
    x: number;
    color: string;
    text: string;
  }> = [
    {
      owner: ricardo,
      bank: ricardoRevolut,
      title: "Rent",
      icon: "🏠",
      amount: -75000,
      x: centerX - 930,
      color: "#fb7185",
      text: "1st of month",
    },
    {
      owner: ricardo,
      bank: ricardoBoi,
      title: "Utilities",
      icon: "⚡",
      amount: -12000,
      x: centerX - 720,
      color: "#fb923c",
      text: "Electricity · monthly",
    },
    {
      owner: ricardo,
      bank: ricardoRevolut,
      title: "Spotify",
      icon: "♫",
      amount: -1499,
      x: centerX - 510,
      color: "#22c55e",
      text: "Subscription · monthly",
    },
    {
      owner: ricardo,
      bank: ricardoBoi,
      title: "Groceries",
      icon: "🛒",
      amount: -32000,
      x: centerX - 300,
      color: "#fb923c",
      text: "Average monthly",
    },
    {
      owner: ricardo,
      bank: ricardoBoi,
      title: "Savings",
      icon: "🐷",
      amount: 30000,
      x: centerX - 90,
      color: "#22c55e",
      text: "Monthly transfer",
    },
    {
      owner: janet,
      bank: janetAib,
      title: "Rent",
      icon: "🏠",
      amount: -75000,
      x: centerX + 140,
      color: "#fb7185",
      text: "Shared · monthly",
    },
    {
      owner: janet,
      bank: janetAib,
      title: "Subscriptions",
      icon: "▦",
      amount: -2748,
      x: centerX + 350,
      color: "#a855f7",
      text: "Streaming & cloud",
    },
    {
      owner: janet,
      bank: janetRevolut,
      title: "Groceries",
      icon: "🛒",
      amount: -32000,
      x: centerX + 560,
      color: "#fb923c",
      text: "Shared · monthly",
    },
    {
      owner: janet,
      bank: janetRevolut,
      title: "Savings",
      icon: "🐷",
      amount: 50000,
      x: centerX + 770,
      color: "#22c55e",
      text: "Monthly transfer",
    },
  ];

  for (const item of destinations) {
    const node = financeNode(
      sceneId,
      "destination",
      item.title,
      item.text,
      item.icon,
      item.color,
      item.x,
      centerY + 360,
      175,
      125,
      {
        ownerId: item.owner.id,
        category: item.title.toLowerCase(),
        amountCents: item.amount,
        currency: "EUR",
        cadence: "monthly",
      },
    );
    nodes.push(node);
    const kind =
      item.amount > 0 ? ("transfer" as const) : ("outgoing" as const);
    connections.push(
      connection(
        item.bank.id,
        node.id,
        kind,
        money(item.amount),
        item.amount,
      ),
    );
  }

  connections.push(
    connection(ricardo.id, ricardoRevolut.id, "structure", "Revolut"),
    connection(ricardo.id, ricardoBoi.id, "structure", "BOI"),
    connection(janet.id, janetAib.id, "structure", "AIB"),
    connection(janet.id, janetRevolut.id, "structure", "Revolut"),
    connection(
      ricardoWork.id,
      ricardoRevolut.id,
      "incoming",
      "+€2,850",
      285000,
    ),
    connection(
      janetWork.id,
      janetAib.id,
      "incoming",
      "+€3,200",
      320000,
    ),
    connection(ricardo.id, janet.id, "shared", "Shared goals"),
  );

  return {
    sceneId,
    nodes,
    connections,
    personIds: [ricardo.id, janet.id],
  };
}
