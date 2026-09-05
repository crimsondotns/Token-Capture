import type { ChimeName } from "./chime";

export type Source = "dex" | "cmc";
export type SourcePref = "auto" | Source;

export type DexRow = {
  kind: "dex";
  symbol: string;
  name: string;
  chain: string;
  dexId: string;
  quote: string;
  contract: string;
  poolAddress: string;
  url: string;
  imageUrl: string;
  priceUsd: string;
  supply: string;
  totalSupply: string;
};

export type CmcRow = {
  kind: "cmc";
  avatar: string;
  symbol: string;
  slug: string;
  id: number | null;
  platformId: number | null;
  platformName: string;
  tokenAddress: string;
};

export type ScanRow = DexRow | CmcRow;

export type ScanOk = {
  ok: true;
  source: Source;
  query: string;
  title: string;
  subtitle: string;
  rows: ScanRow[];
};

export type ScanErr = {
  ok: false;
  error: string;
};

export type ScanResult = ScanOk | ScanErr;

export type Settings = {
  sheetUrl: string;
  sheetSameTab: boolean;
  deriveAvatar: boolean;
  nativeAsUcid: boolean;
  sound: boolean;
  /** 0-1, as the slider reports it. */
  volume: number;
  chime: ChimeName;
};

export const DEFAULT_SETTINGS: Settings = {
  // No sheet by default: the destination is the operator's own, and one
  // baked in here would ship in every build and every extension zip.
  sheetUrl: "",
  sheetSameTab: false,
  deriveAvatar: true,
  nativeAsUcid: true,
  sound: true,
  volume: 0.9,
  chime: "chime",
};

export const DEX_COLUMNS = [
  "Symbol",
  "ChainID",
  "DexID",
  "Quote",
  "Contract",
  "Pool Address",
] as const;

export const CMC_COLUMNS = [
  "Avatar",
  "Symbol",
  "Slug",
  "ID",
  "PlatformID",
  "PlatformName",
  "TokenAddress",
] as const;

export const STORAGE_KEY = "xcap-settings-v1";
