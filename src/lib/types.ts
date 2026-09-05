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
};

export const DEFAULT_SETTINGS: Settings = {
  sheetUrl:
    "https://docs.google.com/spreadsheets/d/1Yk2vMgJEQEidZ0D7EjQMZcRDXwaMghtTQhEMvsOCpsE/edit?gid=808635128#gid=808635128",
  sheetSameTab: false,
  deriveAvatar: true,
  nativeAsUcid: true,
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
