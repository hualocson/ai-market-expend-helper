import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from "idb";

export type IndexedDbUpgradeCallback<TSchema extends DBSchema> = (
  database: IDBPDatabase<TSchema>,
  oldVersion: number,
  newVersion: number | null,
  transaction: IDBPTransaction<TSchema, StoreNames<TSchema>[], "versionchange">
) => void;

export type IndexedDbClientOptions<TSchema extends DBSchema> = {
  name: string;
  version: number;
  upgrade: IndexedDbUpgradeCallback<TSchema>;
};
