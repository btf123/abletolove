import type {
  PlatformType,
  ContentType,
  FormattedPost,
  PlatformPostResult,
  PlatformComment,
  AccountMetrics,
  PostMetrics,
  TrendingItem,
} from '@smbot/shared';

export abstract class BasePlatform {
  abstract readonly name: PlatformType;
  abstract readonly maxCaptionLength: number;
  abstract readonly supportedContentTypes: ContentType[];

  abstract connect(credentials: Record<string, string>): Promise<void>;
  abstract refreshToken(accountId: string): Promise<void>;
  abstract isTokenValid(accountId: string): Promise<boolean>;

  abstract publishPost(accountId: string, post: FormattedPost): Promise<PlatformPostResult>;
  abstract deletePost(accountId: string, platformPostId: string): Promise<void>;

  abstract fetchComments(accountId: string, platformPostId: string, since?: Date): Promise<PlatformComment[]>;
  abstract replyToComment(accountId: string, commentId: string, text: string): Promise<void>;

  abstract getAccountMetrics(accountId: string): Promise<AccountMetrics>;
  abstract getPostMetrics(accountId: string, platformPostId: string): Promise<PostMetrics>;

  fetchTrending?(): Promise<TrendingItem[]>;
}
