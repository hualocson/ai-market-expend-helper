import {
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  type StoreNames,
  deleteDB,
  openDB,
} from "idb";

import type { IndexedDbClientOptions } from "./types";

type IndexedDbTransactionMode = "readonly" | "readwrite";

export const createIndexedDbClient = <TSchema extends DBSchema>({
  name,
  version,
  upgrade,
}: IndexedDbClientOptions<TSchema>) => {
  let databasePromise: Promise<IDBPDatabase<TSchema>> | null = null;

  const clearCachedDatabase = () => {
    databasePromise = null;
  };

  const open = async (): Promise<IDBPDatabase<TSchema>> => {
    if (!databasePromise) {
      let wasBlocked = false;
      let rejectBlockedOpen: (error: Error) => void;
      const blockedPromise = new Promise<never>((_, reject) => {
        rejectBlockedOpen = reject;
      });
      const openPromise = openDB<TSchema>(name, version, {
        upgrade,
        blocked() {
          wasBlocked = true;
          clearCachedDatabase();
          rejectBlockedOpen(
            new Error(`Opening IndexedDB database "${name}" was blocked.`)
          );
        },
        blocking() {
          void databasePromise
            ?.then((database) => {
              database.close();
            })
            .catch(() => undefined);
          clearCachedDatabase();
        },
        terminated() {
          clearCachedDatabase();
        },
      });

      void openPromise.then(
        (database) => {
          if (wasBlocked) {
            database.close();
          }
        },
        () => undefined
      );

      databasePromise = Promise.race([openPromise, blockedPromise]).catch(
        (error) => {
          clearCachedDatabase();
          throw error;
        }
      );
    }

    return databasePromise;
  };

  const close = async (): Promise<void> => {
    const database = await databasePromise?.catch(() => null);
    database?.close();
    clearCachedDatabase();
  };

  const deleteDatabase = async (): Promise<void> => {
    await close();
    let rejectBlockedDelete: (error: Error) => void;
    const blockedPromise = new Promise<never>((_, reject) => {
      rejectBlockedDelete = reject;
    });
    const deletePromise = deleteDB(name, {
      blocked() {
        clearCachedDatabase();
        rejectBlockedDelete(
          new Error(`Deleting IndexedDB database "${name}" was blocked.`)
        );
      },
    });

    void deletePromise.catch(() => undefined);

    await Promise.race([deletePromise, blockedPromise]).catch((error) => {
      clearCachedDatabase();
      throw error;
    });
  };

  const withTransaction = async <
    TStores extends StoreNames<TSchema>[],
    TMode extends IndexedDbTransactionMode,
    TResult,
  >(
    stores: TStores,
    mode: TMode,
    callback: (
      transaction: IDBPTransaction<TSchema, TStores, TMode>
    ) => TResult | Promise<TResult>
  ): Promise<TResult> => {
    const database = await open();
    const transaction = database.transaction(stores, mode);

    try {
      const result = await callback(transaction);
      await transaction.done;
      return result;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already be finished or inactive.
      }
      await transaction.done.catch(() => undefined);
      throw error;
    }
  };

  return {
    open,
    close,
    deleteDatabase,
    withTransaction,
  };
};
