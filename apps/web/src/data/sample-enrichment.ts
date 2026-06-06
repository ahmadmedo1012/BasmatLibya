import type { EnrichmentSlot } from '@basmat/shared'

export const SAMPLE_ENRICHMENT: EnrichmentSlot = {
  status: 'ready',
  payload: {
    headlineAr: 'محمد علي - نشاط رقمي متنوع',
    summaryAr: 'يظهر التحليل أن محمد علي لديه وجود رقمي نشط في وسائل التواصل الاجتماعي، مع ملفات فيسبوك وتويتر ولينكد إن. النشاط يركز على التكنولوجيا وريادة الأعمال.',
    highlightsAr: [
      'حسابات موثّقة في أكثر من منصة',
      'نشاط منتظم منذ ٢٠١٨',
      'توصيات إيجابية من زملاء سابقين',
      'حضور في الفعاليات التقنية المحلية',
    ],
    identityClusters: [
      {
        labelAr: 'شخصية تقنية',
        confidence: 'high',
        findingIds: ['f1a2b3c4-1111-4000-8000-000000000001', 'f1a2b3c4-1111-4000-8000-000000000002'],
        rationaleAr: 'حسابات في منصات تقنية مع محتوى احترافي وتقني.',
      },
      {
        labelAr: 'ناشط مجتمعي',
        confidence: 'medium',
        findingIds: ['f1a2b3c4-1111-4000-8000-000000000004'],
        rationaleAr: 'مشاركة في فعاليات مجتمعية ومقالات في منصات محلية.',
      },
    ],
    riskFlagsAr: [],
    gapsAr: ['لا توجد بيانات كافية عن النشاط المهني الحالي', 'مصدر الدخل الرئيسي غير موثّق'],
    modelChain: {
      analyzer: 'gpt-4o',
      reasoner: 'gpt-4o-mini',
      writer: 'gpt-4o-mini',
    },
  },
}
