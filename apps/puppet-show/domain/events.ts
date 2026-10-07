export type EventRecord = {
  id: string;
  name: string;
  description: string;
  location: string;
  date: Date | string;
  likes: number;
  subscriptions: number;
  imageUrl?: string;
  isLiked?: boolean;
  isSubscribed?: boolean;
  publishedAt: Date | string;
};
