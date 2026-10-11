export const publicUserSelect = {
  id: true,
  username: true,
  name: true,
  avatarUrl: true,
  isVerified: true,
} as const;

export type PublicUser = { id: string; username: string; name: string; avatarUrl: string | null; isVerified: boolean };
