import type { CategoryBlock } from '@basmat/shared'

export const SAMPLE_CATEGORIES: CategoryBlock[] = [
  {
    key: 'social_presence',
    displayLabelAr: 'الوجود في وسائل التواصل',
    state: 'completed',
    findings: [
      {
        id: 'f1a2b3c4-1111-4000-8000-000000000001',
        categoryKey: 'social_presence',
        title: 'ملف فيسبوك',
        snippet: 'حساب شخصي باسم "محمد علي" مع نشاط منتظم منذ 2018.',
        sourceUrl: 'https://facebook.com/',
        sourceName: 'فيسبوك',
        language: 'ar',
        confidence: 'high',
        metadata: {
          fullname: 'محمد علي',
          location: 'طرابلس، ليبيا',
          followerCount: 845,
          joinedAt: '2018-03-12T00:00:00Z',
        },
      },
      {
        id: 'f1a2b3c4-1111-4000-8000-000000000002',
        categoryKey: 'social_presence',
        title: 'ملف تويتر',
        snippet: 'حساب موثّق مع ٣٢٠٠ متابع، تغريدات حول التكنولوجيا والأعمال.',
        sourceUrl: 'https://x.com/',
        sourceName: 'X (تويتر)',
        language: 'ar',
        confidence: 'high',
        metadata: {
          fullname: 'محمد علي',
          bio: 'مهتم بالتكنولوجيا وريادة الأعمال',
          followerCount: 3200,
          followingCount: 412,
          location: 'ليبيا',
          joinedAt: '2019-07-22T00:00:00Z',
          isVerified: true,
        },
      },
      {
        id: 'f1a2b3c4-1111-4000-8000-000000000003',
        categoryKey: 'social_presence',
        title: 'ملف لينكد إن',
        snippet: 'ملف مهني يظهر خبرة في مجال تقنية المعلومات.',
        sourceUrl: 'https://linkedin.com/',
        sourceName: 'لينكد إن',
        language: 'en',
        confidence: 'medium',
        metadata: {
          fullname: 'Mohamed Ali',
          company: 'شركة تقنية محلية',
          location: 'Tripoli, Libya',
        },
      },
    ],
  },
  {
    key: 'public_mentions',
    displayLabelAr: 'الإشارات العامة',
    state: 'completed',
    findings: [
      {
        id: 'f1a2b3c4-1111-4000-8000-000000000004',
        categoryKey: 'public_mentions',
        title: 'مقال في موقع أخباري',
        snippet: 'ذكر في مقال حول ملتقى ريادة الأعمال الليبي ٢٠٢٤.',
        sourceUrl: 'https://example-news.ly/',
        sourceName: 'بوابة الوسط',
        language: 'ar',
        confidence: 'medium',
      },
      {
        id: 'f1a2b3c4-1111-4000-8000-000000000005',
        categoryKey: 'public_mentions',
        title: 'منشور في مدونة',
        snippet: 'كاتب ضيف في مدونة تقنية حول التحول الرقمي.',
        sourceUrl: 'https://blog.example.ly/',
        sourceName: 'مدونة تقنية ليبية',
        language: 'ar',
        confidence: 'low',
        metadata: {
          tags: ['تحول رقمي', 'ريادة أعمال'],
        },
      },
    ],
  },
  {
    key: 'contact_signals',
    displayLabelAr: 'معلومات الاتصال',
    state: 'completed',
    findings: [
      {
        id: 'f1a2b3c4-1111-4000-8000-000000000006',
        categoryKey: 'contact_signals',
        title: 'بريد إلكتروني',
        snippet: 'بريد إلكتروني مرتبط بحسابات التواصل الاجتماعية.',
        sourceUrl: null,
        sourceName: 'تحليل الشبكات',
        language: null,
        confidence: 'medium',
      },
    ],
  },
  {
    key: 'reputation_indicators',
    displayLabelAr: 'مؤشرات السمعة',
    state: 'completed',
    findings: [
      {
        id: 'f1a2b3c4-1111-4000-8000-000000000007',
        categoryKey: 'reputation_indicators',
        title: 'تقييم إيجابي',
        snippet: 'توصيات إيجابية من زملاء سابقين.',
        sourceUrl: null,
        sourceName: 'لينكد إن',
        language: 'ar',
        confidence: 'medium',
      },
    ],
  },
  {
    key: 'profile_imagery',
    displayLabelAr: 'الصور والملفات الشخصية',
    state: 'completed',
    findings: [
      {
        id: 'f1a2b3c4-1111-4000-8000-000000000008',
        categoryKey: 'profile_imagery',
        title: 'صورة شخصية',
        snippet: 'صورة شخصية على حسابات التواصل.',
        sourceUrl: null,
        sourceName: 'فيسبوك',
        language: null,
        confidence: 'high',
        metadata: {
          imageUrl: null,
        },
      },
    ],
  },
]

export const SAMPLE_TOTAL_FINDINGS = SAMPLE_CATEGORIES.reduce(
  (acc, c) => acc + c.findings.length,
  0
)
