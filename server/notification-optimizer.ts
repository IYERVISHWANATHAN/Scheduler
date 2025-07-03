import { 
  userNotificationPreferences, 
  notificationBehaviorTracking, 
  notificationRecommendations,
  meetings,
  type UserNotificationPreferences,
  type InsertUserNotificationPreferences,
  type NotificationBehaviorTracking,
  type InsertNotificationBehaviorTracking,
  type NotificationRecommendations,
  type InsertNotificationRecommendations
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, desc, sql, avg, count } from "drizzle-orm";

export interface NotificationOptimizationInsights {
  userId: number;
  category: string;
  recommendations: SmartRecommendation[];
  currentEffectiveness: number;
  potentialImprovement: number;
  lastAnalyzed: Date;
}

export interface SmartRecommendation {
  type: 'timing' | 'channel' | 'frequency';
  current: string;
  recommended: string;
  confidence: number;
  reasoning: string;
  expectedImprovement: string;
}

export interface NotificationMetrics {
  openRate: number;
  clickRate: number;
  responseRate: number;
  attendanceRate: number;
  averageResponseTime: number;
  preferredTimeOfDay: string;
  preferredDayOfWeek: string;
  mostEffectiveChannel: string;
}

export class NotificationOptimizer {
  
  // Analyze user notification behavior and generate smart recommendations
  async analyzeUserBehavior(userId: number, category?: string): Promise<NotificationOptimizationInsights[]> {
    const insights: NotificationOptimizationInsights[] = [];
    
    // Get all categories for the user if none specified
    const categories = category ? [category] : await this.getUserCategories(userId);
    
    for (const cat of categories) {
      const metrics = await this.calculateNotificationMetrics(userId, cat);
      const recommendations = await this.generateRecommendations(userId, cat, metrics);
      const currentEffectiveness = this.calculateCurrentEffectiveness(metrics);
      const potentialImprovement = this.calculatePotentialImprovement(recommendations);
      
      insights.push({
        userId,
        category: cat,
        recommendations,
        currentEffectiveness,
        potentialImprovement,
        lastAnalyzed: new Date()
      });
    }
    
    return insights;
  }

  // Calculate comprehensive notification metrics for a user and category
  private async calculateNotificationMetrics(userId: number, category: string): Promise<NotificationMetrics> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get all notification behavior data for the past 30 days
    const behaviorData = await db
      .select()
      .from(notificationBehaviorTracking)
      .where(and(
        eq(notificationBehaviorTracking.userId, userId),
        eq(notificationBehaviorTracking.category, category),
        gte(notificationBehaviorTracking.sentAt, thirtyDaysAgo)
      ));
    
    if (behaviorData.length === 0) {
      return this.getDefaultMetrics();
    }
    
    const totalNotifications = behaviorData.length;
    const openedCount = behaviorData.filter(b => b.openedAt).length;
    const clickedCount = behaviorData.filter(b => b.clickedAt).length;
    const respondedCount = behaviorData.filter(b => b.respondedAt).length;
    const attendedCount = behaviorData.filter(b => b.meetingAttended === true).length;
    
    // Calculate response times
    const responseTimes = behaviorData
      .filter(b => b.sentAt && b.respondedAt)
      .map(b => (b.respondedAt!.getTime() - b.sentAt.getTime()) / (1000 * 60)); // minutes
    
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    // Analyze time patterns
    const timeOfDayAnalysis = this.analyzeTimePatterns(behaviorData);
    const dayOfWeekAnalysis = this.analyzeDayPatterns(behaviorData);
    const channelAnalysis = this.analyzeChannelEffectiveness(behaviorData);
    
    return {
      openRate: (openedCount / totalNotifications) * 100,
      clickRate: (clickedCount / totalNotifications) * 100,
      responseRate: (respondedCount / totalNotifications) * 100,
      attendanceRate: (attendedCount / totalNotifications) * 100,
      averageResponseTime,
      preferredTimeOfDay: timeOfDayAnalysis.best,
      preferredDayOfWeek: dayOfWeekAnalysis.best,
      mostEffectiveChannel: channelAnalysis.best
    };
  }

  // Generate smart recommendations based on behavior metrics
  private async generateRecommendations(
    userId: number, 
    category: string, 
    metrics: NotificationMetrics
  ): Promise<SmartRecommendation[]> {
    const recommendations: SmartRecommendation[] = [];
    const currentPrefs = await this.getCurrentPreferences(userId, category);
    
    // Timing recommendations
    if (metrics.openRate < 60) {
      recommendations.push({
        type: 'timing',
        current: `${currentPrefs?.emailAdvanceMinutes || 30} minutes before`,
        recommended: this.getOptimalTiming(metrics),
        confidence: this.calculateConfidence(metrics.openRate, 60),
        reasoning: `Your current notifications are opened only ${metrics.openRate.toFixed(1)}% of the time. ` +
                  `Based on your behavior, ${metrics.preferredTimeOfDay} notifications perform better.`,
        expectedImprovement: `+${this.estimateImprovementPercentage(metrics.openRate, 60)}% open rate`
      });
    }
    
    // Channel recommendations
    if (metrics.mostEffectiveChannel !== this.getCurrentPrimaryChannel(currentPrefs)) {
      recommendations.push({
        type: 'channel',
        current: this.getCurrentPrimaryChannel(currentPrefs),
        recommended: metrics.mostEffectiveChannel,
        confidence: this.calculateChannelConfidence(metrics),
        reasoning: `${metrics.mostEffectiveChannel} notifications show ${this.getChannelPerformance(metrics.mostEffectiveChannel)}% better engagement than your current primary channel.`,
        expectedImprovement: `+${this.estimateChannelImprovement(metrics)}% engagement rate`
      });
    }
    
    // Frequency recommendations
    if (metrics.responseRate < 40) {
      recommendations.push({
        type: 'frequency',
        current: 'Standard frequency',
        recommended: 'Reduced frequency with strategic timing',
        confidence: this.calculateFrequencyConfidence(metrics),
        reasoning: `Your response rate is ${metrics.responseRate.toFixed(1)}%. Reducing notification frequency while optimizing timing can improve engagement.`,
        expectedImprovement: `+${this.estimateFrequencyImprovement(metrics)}% response rate`
      });
    }
    
    return recommendations;
  }

  // Store recommendations in the database
  async storeRecommendations(insights: NotificationOptimizationInsights[]): Promise<void> {
    for (const insight of insights) {
      for (const recommendation of insight.recommendations) {
        const currentSetting = await this.getCurrentPreferences(insight.userId, insight.category);
        
        await db.insert(notificationRecommendations).values({
          userId: insight.userId,
          category: insight.category,
          recommendationType: recommendation.type,
          currentSetting: recommendation.current,
          recommendedSetting: recommendation.recommended,
          confidenceScore: Math.round(recommendation.confidence),
          reasoning: recommendation.reasoning,
          potentialImprovement: recommendation.expectedImprovement
        });
      }
    }
  }

  // Apply a specific recommendation
  async applyRecommendation(recommendationId: number): Promise<boolean> {
    const recommendation = await db
      .select()
      .from(notificationRecommendations)
      .where(eq(notificationRecommendations.id, recommendationId))
      .limit(1);
    
    if (recommendation.length === 0) return false;
    
    const rec = recommendation[0];
    const success = await this.updateUserPreferences(rec.userId, rec.category, rec);
    
    if (success) {
      await db
        .update(notificationRecommendations)
        .set({ 
          isApplied: true, 
          appliedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(notificationRecommendations.id, recommendationId));
    }
    
    return success;
  }

  // Track notification behavior for future optimization
  async trackNotificationBehavior(data: InsertNotificationBehaviorTracking): Promise<void> {
    await db.insert(notificationBehaviorTracking).values({
      ...data,
      timeOfDay: this.getTimeOfDay(data.sentAt),
      dayOfWeek: this.getDayOfWeek(data.sentAt)
    });
  }

  // Get user's current notification preferences
  private async getCurrentPreferences(userId: number, category: string): Promise<UserNotificationPreferences | null> {
    const prefs = await db
      .select()
      .from(userNotificationPreferences)
      .where(and(
        eq(userNotificationPreferences.userId, userId),
        eq(userNotificationPreferences.category, category)
      ))
      .limit(1);
    
    return prefs[0] || null;
  }

  // Update user preferences based on recommendations
  private async updateUserPreferences(
    userId: number, 
    category: string, 
    recommendation: NotificationRecommendations
  ): Promise<boolean> {
    try {
      const updates: Partial<InsertUserNotificationPreferences> = {};
      
      switch (recommendation.recommendationType) {
        case 'timing':
          updates.emailAdvanceMinutes = this.extractMinutesFromRecommendation(recommendation.recommendedSetting);
          break;
        case 'channel':
          this.updateChannelPreferences(updates, recommendation.recommendedSetting);
          break;
        case 'frequency':
          this.updateFrequencyPreferences(updates, recommendation.recommendedSetting);
          break;
      }
      
      await db
        .insert(userNotificationPreferences)
        .values({
          userId,
          category,
          ...updates,
          isOptimized: true,
          lastOptimizedAt: new Date()
        })
        .onConflictDoUpdate({
          target: [userNotificationPreferences.userId, userNotificationPreferences.category],
          set: {
            ...updates,
            isOptimized: true,
            lastOptimizedAt: new Date(),
            updatedAt: new Date()
          }
        });
      
      return true;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      return false;
    }
  }

  // Helper methods for analysis
  private analyzeTimePatterns(behaviorData: NotificationBehaviorTracking[]) {
    const timePatterns = { morning: 0, afternoon: 0, evening: 0 };
    const timeEngagement = { morning: 0, afternoon: 0, evening: 0 };
    
    behaviorData.forEach(data => {
      timePatterns[data.timeOfDay as keyof typeof timePatterns]++;
      if (data.openedAt || data.clickedAt) {
        timeEngagement[data.timeOfDay as keyof typeof timeEngagement]++;
      }
    });
    
    const bestTime = Object.entries(timeEngagement).reduce((a, b) => 
      timeEngagement[a[0] as keyof typeof timeEngagement] > timeEngagement[b[0] as keyof typeof timeEngagement] ? a : b
    )[0];
    
    return { best: bestTime, patterns: timePatterns, engagement: timeEngagement };
  }

  private analyzeDayPatterns(behaviorData: NotificationBehaviorTracking[]) {
    const dayPatterns: Record<string, number> = {};
    const dayEngagement: Record<string, number> = {};
    
    behaviorData.forEach(data => {
      dayPatterns[data.dayOfWeek] = (dayPatterns[data.dayOfWeek] || 0) + 1;
      if (data.openedAt || data.clickedAt) {
        dayEngagement[data.dayOfWeek] = (dayEngagement[data.dayOfWeek] || 0) + 1;
      }
    });
    
    const bestDay = Object.entries(dayEngagement).reduce((a, b) => 
      (dayEngagement[a[0]] || 0) > (dayEngagement[b[0]] || 0) ? a : b
    )[0];
    
    return { best: bestDay, patterns: dayPatterns, engagement: dayEngagement };
  }

  private analyzeChannelEffectiveness(behaviorData: NotificationBehaviorTracking[]) {
    const channels: Record<string, { sent: number; engaged: number }> = {};
    
    behaviorData.forEach(data => {
      if (!channels[data.notificationType]) {
        channels[data.notificationType] = { sent: 0, engaged: 0 };
      }
      channels[data.notificationType].sent++;
      if (data.openedAt || data.clickedAt || data.respondedAt) {
        channels[data.notificationType].engaged++;
      }
    });
    
    const bestChannel = Object.entries(channels).reduce((best, [channel, stats]) => {
      const rate = stats.engaged / stats.sent;
      const bestRate = channels[best[0]]?.engaged / channels[best[0]]?.sent || 0;
      return rate > bestRate ? [channel, stats] : best;
    })[0];
    
    return { best: bestChannel, channels };
  }

  private getTimeOfDay(date: Date): string {
    const hour = date.getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  private getDayOfWeek(date: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  }

  private calculateCurrentEffectiveness(metrics: NotificationMetrics): number {
    return (metrics.openRate + metrics.clickRate + metrics.responseRate + metrics.attendanceRate) / 4;
  }

  private calculatePotentialImprovement(recommendations: SmartRecommendation[]): number {
    return recommendations.reduce((total, rec) => {
      const improvement = parseFloat(rec.expectedImprovement.match(/\+(\d+)%/)?.[1] || '0');
      return total + improvement;
    }, 0);
  }

  private calculateConfidence(currentRate: number, targetRate: number): number {
    const improvement = targetRate - currentRate;
    return Math.min(95, Math.max(50, 50 + (improvement * 2)));
  }

  private getOptimalTiming(metrics: NotificationMetrics): string {
    if (metrics.preferredTimeOfDay === 'morning') return '45 minutes before (morning meetings)';
    if (metrics.preferredTimeOfDay === 'afternoon') return '20 minutes before (afternoon meetings)';
    return '60 minutes before (evening meetings)';
  }

  private getCurrentPrimaryChannel(prefs: UserNotificationPreferences | null): string {
    if (!prefs) return 'email';
    if (prefs.pushEnabled) return 'push';
    if (prefs.whatsappEnabled) return 'whatsapp';
    if (prefs.emailEnabled) return 'email';
    return 'email';
  }

  private async getUserCategories(userId: number): Promise<string[]> {
    const userPrefs = await db
      .select({ category: userNotificationPreferences.category })
      .from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.userId, userId));
    
    if (userPrefs.length > 0) {
      return userPrefs.map(p => p.category);
    }
    
    // Return default categories if no preferences exist
    return ['liquor', 'tobacco', 'pnc', 'confectionary', 'fashion', 'destination'];
  }

  private getDefaultMetrics(): NotificationMetrics {
    return {
      openRate: 45,
      clickRate: 25,
      responseRate: 35,
      attendanceRate: 80,
      averageResponseTime: 120,
      preferredTimeOfDay: 'morning',
      preferredDayOfWeek: 'Tuesday',
      mostEffectiveChannel: 'email'
    };
  }

  private calculateChannelConfidence(metrics: NotificationMetrics): number {
    return Math.min(90, Math.max(60, metrics.openRate + 20));
  }

  private calculateFrequencyConfidence(metrics: NotificationMetrics): number {
    return Math.min(85, Math.max(55, (100 - metrics.responseRate) + 15));
  }

  private getChannelPerformance(channel: string): number {
    const channelRates: Record<string, number> = {
      push: 85,
      whatsapp: 75,
      email: 60,
      sms: 70
    };
    return channelRates[channel] || 60;
  }

  private estimateImprovementPercentage(current: number, target: number): number {
    return Math.round(((target - current) / current) * 100);
  }

  private estimateChannelImprovement(metrics: NotificationMetrics): number {
    return Math.round((this.getChannelPerformance(metrics.mostEffectiveChannel) - metrics.openRate) * 0.6);
  }

  private estimateFrequencyImprovement(metrics: NotificationMetrics): number {
    return Math.round((40 - metrics.responseRate) * 0.8);
  }

  private extractMinutesFromRecommendation(recommendation: string): number {
    const match = recommendation.match(/(\d+)\s*minutes/);
    return match ? parseInt(match[1]) : 30;
  }

  private updateChannelPreferences(updates: Partial<InsertUserNotificationPreferences>, channel: string) {
    // Reset all channels first
    updates.emailEnabled = false;
    updates.whatsappEnabled = false;
    updates.smsEnabled = false;
    updates.pushEnabled = false;
    
    // Enable recommended channel
    switch (channel) {
      case 'email':
        updates.emailEnabled = true;
        break;
      case 'whatsapp':
        updates.whatsappEnabled = true;
        break;
      case 'sms':
        updates.smsEnabled = true;
        break;
      case 'push':
        updates.pushEnabled = true;
        break;
    }
  }

  private updateFrequencyPreferences(updates: Partial<InsertUserNotificationPreferences>, _frequency: string) {
    // Implement frequency-based updates
    updates.reminderEnabled = true;
    updates.reminderAdvanceMinutes = 120; // Longer lead time for better preparation
  }
}

export const notificationOptimizer = new NotificationOptimizer();