export type SyncEntityName = "expenses";

export type SyncStatus = "synced" | "pending" | "failed" | "deleted";

export type SyncRecord<TPayload = unknown> = {
  entity: SyncEntityName;
  clientId: string;
  serverId: number | null;
  syncStatus: SyncStatus;
  lastError: string | null;
  updatedAt: string;
  serverUpdatedAt: string | null;
  payload: TPayload;
};

export type SyncOperation<TPayload = unknown> = {
  operationId: string;
  entity: SyncEntityName;
  type: "create" | "update" | "delete";
  clientId: string;
  serverId: number | null;
  payload: TPayload | null;
  createdAt: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  lastError: string | null;
};
