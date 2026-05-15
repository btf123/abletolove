declare module 'google-trends-api' {
  interface Options {
    geo?: string;
    category?: string;
    hl?: string;
  }
  const googleTrends: {
    dailyTrends(options?: Options): Promise<string>;
    realTimeTrends(options?: Options): Promise<string>;
    interestOverTime(options?: Options): Promise<string>;
    interestByRegion(options?: Options): Promise<string>;
    relatedTopics(options?: Options): Promise<string>;
    relatedQueries(options?: Options): Promise<string>;
  };
  export default googleTrends;
}
