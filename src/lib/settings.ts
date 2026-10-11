import { db } from "@/lib/db";

export const defaultSettings = {
  diamondPerCoin: "0.5",
  inrPerDiamond: "0.05",
  minWithdrawDiamonds: "1000",
  upiId: "",
  upiName: "Intube Media",
  announcement: "",
  maxVideoSeconds: "180",
  signupsOpen: "true",
} as const;

export type SettingKey = keyof typeof defaultSettings;

export async function getSettings() {
  const rows = await db.setting.findMany();
  const values: Record<string, string> = { ...defaultSettings };
  for (const row of rows) values[row.key] = row.value;
  return values as Record<SettingKey, string>;
}

export async function getSetting(key: SettingKey) {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? defaultSettings[key];
}
