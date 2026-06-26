/**
 * مثال لاستخدام WebSocket client في frontend
 * 
 * هذا الملف يوضح كيفية الاتصال بـ WebSocket server
 * والاستماع لتحديثات الحملات لحظيًا
 */

// تأكد من إضافة socket.io-client إلى مشروع frontend الخاص بك
// npm install socket.io-client

import { io } from 'socket.io-client';

class CampaignWebSocketClient {
  constructor(baseUrl, token) {
    this.socket = io(baseUrl, {
      transports: ['websocket', 'polling'],
      auth: {
        token: token
      }
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    // حدث الاتصال
    this.socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
    });

    // حدث انقطاع الاتصال
    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from WebSocket server');
    });

    // حدث تحديث الحملة
    this.socket.on('campaign-update', (data) => {
      console.log('📢 Campaign update:', data);
      this.handleCampaignUpdate(data);
    });

    // حدث تحديث عام للحملات
    this.socket.on('campaign-global-update', (data) => {
      console.log('🌍 Global campaign update:', data);
      this.handleGlobalUpdate(data);
    });

    // حدث إحصائيات الحملة
    this.socket.on('campaign-stats', (stats) => {
      console.log('📊 Campaign stats:', stats);
      this.handleCampaignStats(stats);
    });
  }

  /**
   * الانضمام إلى غرفة حملة محددة
   * @param {string} campaignId - معرّف الحملة
   */
  joinCampaign(campaignId) {
    this.socket.emit('join-campaign', campaignId);
    console.log(`🔗 Joined campaign room: ${campaignId}`);
  }

  /**
   * مغادرة غرفة حملة محددة
   * @param {string} campaignId - معرّف الحملة
   */
  leaveCampaign(campaignId) {
    this.socket.emit('leave-campaign', campaignId);
    console.log(`🚪 Left campaign room: ${campaignId}`);
  }

  /**
   * الاشتراك في حملات مستخدم معين
   * @param {string} userId - معرّف المستخدم
   */
  subscribeToUserCampaigns(userId) {
    this.socket.emit('subscribe-user-campaigns', userId);
    console.log(`👤 Subscribed to user campaigns: ${userId}`);
  }

  /**
   * معالجة تحديث الحملة
   * @param {Object} data - بيانات التحديث
   */
  handleCampaignUpdate(data) {
    const { campaignId, status, message, progress, timestamp } = data;
    
    // تحديث واجهة المستخدم بناءً على حالة الحملة
    switch (status) {
      case 'started':
        this.showNotification(`بدأت الحملة: ${message}`);
        this.updateCampaignStatus(campaignId, 'running');
        break;
      
      case 'in-progress':
        if (progress) {
          this.updateCampaignProgress(campaignId, progress);
        }
        break;
      
      case 'completed':
        this.showNotification(`اكتملت الحملة: ${message}`);
        this.updateCampaignStatus(campaignId, 'completed');
        break;
      
      case 'error':
        this.showError(`خطأ في الحملة: ${message}`);
        this.updateCampaignStatus(campaignId, 'error');
        break;
      
      default:
        console.log(`Unknown status: ${status}`);
    }
  }

  /**
   * معالجة التحديث العام
   * @param {Object} data - بيانات التحديث
   */
  handleGlobalUpdate(data) {
    // تحديث قائمة الحملات العامة
    this.refreshCampaignsList();
  }

  /**
   * معالجة إحصائيات الحملة
   * @param {Object} stats - إحصائيات الحملة
   */
  handleCampaignStats(stats) {
    // تحديث مخططات الإحصائيات
    this.updateStatsCharts(stats);
  }

  // --- دوال مساعدة للواجهة الأمامية ---

  showNotification(message) {
    // تنفيذ عرض إشعار في واجهة المستخدم
    console.log(`🔔 Notification: ${message}`);
    // مثال: toast.success(message);
  }

  showError(message) {
    // تنفيذ عرض خطأ في واجهة المستخدم
    console.error(`🚨 Error: ${message}`);
    // مثال: toast.error(message);
  }

  updateCampaignStatus(campaignId, status) {
    // تحديث حالة الحملة في واجهة المستخدم
    console.log(`🔄 Campaign ${campaignId} status updated to: ${status}`);
    // مثال: document.querySelector(`#campaign-${campaignId} .status`).textContent = status;
  }

  updateCampaignProgress(campaignId, progress) {
    // تحديث شريط التقدم في واجهة المستخدم
    const { total, processed, sent, failed } = progress;
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
    
    console.log(`📈 Campaign ${campaignId} progress: ${processed}/${total} (${percentage}%)`);
    console.log(`   Sent: ${sent}, Failed: ${failed}`);
    
    // مثال: 
    // document.querySelector(`#campaign-${campaignId} .progress-bar`).style.width = `${percentage}%`;
    // document.querySelector(`#campaign-${campaignId} .progress-text`).textContent = `${processed}/${total}`;
  }

  refreshCampaignsList() {
    // إعادة تحميل قائمة الحملات
    console.log('🔄 Refreshing campaigns list...');
    // مثال: fetchCampaigns();
  }

  updateStatsCharts(stats) {
    // تحديث المخططات البيانية
    console.log('📊 Updating stats charts...');
    // مثال: updateChart('campaign-stats', stats);
  }

  /**
   * قطع الاتصال بـ WebSocket server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      console.log('🔌 Disconnected from WebSocket server');
    }
  }
}

// --- مثال للاستخدام ---

/*
// 1. استيراد المكتبة في مشروع React/Vue/Angular
import CampaignWebSocketClient from './campaign-websocket-client';

// 2. إنشاء اتصال عند تسجيل دخول المستخدم
const token = 'your-jwt-token-here'; // احصل على التوكن بعد تسجيل الدخول
const baseUrl = 'https://auto-teller-back-end-production.up.railway.app';

const campaignSocket = new CampaignWebSocketClient(baseUrl, token);

// 3. الانضمام إلى حملة محددة عند عرض تفاصيلها
campaignSocket.joinCampaign('campaign-id-123');

// 4. الاشتراك في حملات المستخدم الحالي
campaignSocket.subscribeToUserCampaigns('user-id-456');

// 5. قطع الاتصال عند تسجيل الخروج
campaignSocket.disconnect();
*/

// تصدير الكلاس للاستخدام
export default CampaignWebSocketClient;