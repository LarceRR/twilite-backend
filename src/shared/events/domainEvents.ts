export const domainEventNames = {
  entitlementsChanged: 'billing.entitlementsChanged',
  pixelObjectPublished: 'pixel_object.published',
  pixelObjectStatusChanged: 'pixel_object.status_changed',
  pixelObjectArchived: 'pixel_object.archived',
} as const;

export type EntitlementsChangedEvent = {
  readonly userId: string;
};

export type PixelObjectPublishedEvent = {
  readonly pixelObjectId: string;
  readonly revision: number;
  readonly mobile: import('@/shared/contracts/pixelObjects.contract').PixelObjectMobileDto;
};

export type PixelObjectStatusChangedEvent = {
  readonly pixelObjectId: string;
  readonly revision: number;
  readonly status: string;
};

export type PixelObjectArchivedEvent = {
  readonly pixelObjectId: string;
  readonly revision: number;
};
