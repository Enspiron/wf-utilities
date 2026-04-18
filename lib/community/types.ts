export type AppRole = 'user' | 'moderator' | 'admin';
export type PublishStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';
export type SourceType = 'save_slot' | 'eliya_link' | 'custom';
export type Visibility = 'private' | 'unlisted' | 'public';

export type TeamBuild = {
  mainUnitIds: number[];
  unisonUnitIds: number[];
  equipmentIds: number[];
  soulIds: number[];
  slotMeta?: Record<string, unknown>;
};

export type TeamImportPayload = {
  title: string;
  sourceType: SourceType;
  build: TeamBuild;
  rawSnapshot: Record<string, unknown>;
  warnings: string[];
};

export type SaveDocument = {
  data_headers: Record<string, unknown>;
  data: Record<string, unknown>;
};
