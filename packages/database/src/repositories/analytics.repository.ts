import { BaseRepository } from './base.repository';

export class AnalyticsRepository extends BaseRepository {
  recordPageView(visitorId: string, path: string) {
    return this.db.analyticsEvent.create({ data: { visitorId, path, type: 'page_view' } });
  }

  async getTrafficSummary(since: Date) {
    const [pageViews, visitors] = await Promise.all([
      this.db.analyticsEvent.count({ where: { type: 'page_view', createdAt: { gte: since } } }),
      this.db.analyticsEvent.groupBy({ by: ['visitorId'], where: { type: 'page_view', createdAt: { gte: since } } }),
    ]);
    return { pageViews, visitors: visitors.length };
  }
}
